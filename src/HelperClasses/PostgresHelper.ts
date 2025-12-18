import SSHClient from "../SSHClient/SSHClient";

interface PostgresConfig {
    database: string;
    username: string;
    password: string;
}
interface CommandResult {
    command: string;
    output: string;
    exitCode: number;
}

class PostgresSSHHelper {
    constructor(private ssh: SSHClient) {}

    async install(onLog?: (chunk: string) => void): Promise<void> {
        await this.ssh.runSequential([
            'sudo apt update',
            'sudo apt install -y postgresql postgresql-contrib'
        ], onLog);
    }

    async checkStatus(): Promise<boolean> {
        const result = await this.ssh.exec(
            'sudo systemctl is-active postgresql'
        );
        return result.output.trim() === 'active';
    }

    async start(onLog?: (chunk: string) => void): Promise<void> {
        await this.ssh.exec('sudo systemctl start postgresql', onLog);
    }

    async createUserAndDatabase(
        config: PostgresConfig,
        onLog?: (chunk: string) => void
    ): Promise<void> {
        // Check if user exists
        const userExists = await this.ssh.exec(
            `sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${config.username}'"`
        );

        if (!userExists.output.trim()) {
            await this.ssh.exec(
                `sudo -u postgres psql -c "CREATE USER ${config.username} WITH PASSWORD '${config.password}';"`,
                onLog
            );
        }

        // Check if database exists
        const dbExists = await this.ssh.exec(
            `sudo -u postgres psql -lqt | cut -d \\| -f 1 | grep -qw ${config.database} && echo "1" || echo "0"`
        );

        if (dbExists.output.trim() === '0') {
            await this.ssh.exec(
                `sudo -u postgres psql -c "CREATE DATABASE ${config.database} OWNER ${config.username};"`,
                onLog
            );
        }

        await this.ssh.exec(
            `sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${config.database} TO ${config.username};"`,
            onLog
        );
    }

    async executeSQL(
        sql: string,
        database: string = 'postgres',
        onLog?: (chunk: string) => void
    ): Promise<CommandResult> {
        return await this.ssh.exec(
            `sudo -u postgres psql -d ${database} -c "${sql.replace(/"/g, '\\"')}"`,
            onLog
        );
    }

    async executeSQLFile(
        sqlContent: string,
        database: string = 'postgres',
        onLog?: (chunk: string) => void
    ): Promise<void> {
        const tmpFile = `/tmp/sql_${Date.now()}.sql`;

        // Write SQL to temp file
        await this.ssh.exec(`cat > ${tmpFile} << 'EOSQL'
${sqlContent}
EOSQL`);

        // Execute it
        await this.ssh.exec(
            `sudo -u postgres psql -d ${database} -f ${tmpFile}`,
            onLog
        );

        // Clean up
        await this.ssh.exec(`rm ${tmpFile}`);
    }

    async allowRemoteConnections(onLog?: (chunk: string) => void): Promise<void> {
        // Find PostgreSQL version directory
        const versionResult = await this.ssh.exec(
            `ls /etc/postgresql/ | head -n 1`
        );
        const version = versionResult.output.trim();

        await this.ssh.runSequential([
            // Backup original configs
            `sudo cp /etc/postgresql/${version}/main/postgresql.conf /etc/postgresql/${version}/main/postgresql.conf.bak`,
            `sudo cp /etc/postgresql/${version}/main/pg_hba.conf /etc/postgresql/${version}/main/pg_hba.conf.bak`,

            // Update postgresql.conf
            `sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/${version}/main/postgresql.conf`,

            // Add remote access to pg_hba.conf
            `echo "host    all             all             0.0.0.0/0               scram-sha-256" | sudo tee -a /etc/postgresql/${version}/main/pg_hba.conf`,

            // Restart PostgreSQL
            'sudo systemctl restart postgresql'
        ], onLog);
    }
}

// Usage example:
async function setupPostgres() {
    const ssh = new SSHClient({
        host: 'your-server.com',
        username: 'ubuntu',
        privateKey: '...'
    });

    await ssh.connect();

    const pgHelper = new PostgresSSHHelper(ssh);

    // Install
    await pgHelper.install((log) => console.log(log));

    // Start
    await pgHelper.start();

    // Create user and database
    await pgHelper.createUserAndDatabase({
        database: 'myapp',
        username: 'appuser',
        password: 'securepassword123'
    });

    // Execute custom SQL
    await pgHelper.executeSQL(
        'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));',
        'myapp'
    );

    ssh.close();
}