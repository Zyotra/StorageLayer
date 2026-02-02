import SSHClient from "../SSHClient/SSHClient";
import Papa from "papaparse";
interface PostgresConfig {
  database: string;
  username?: string;
  password: string;
}

interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
}

export class PostgresSSHHelper {
  constructor(private ssh: SSHClient) {}

  async install(onLog?: (chunk: string) => void): Promise<void> {
    // First, check if PostgreSQL is already installed
    const checkInstalled = await this.ssh.exec("dpkg -l | grep postgresql 2>/dev/null || true", onLog);
    if (checkInstalled.output.includes("postgresql") && checkInstalled.output.includes("ii")) {
      if (onLog) onLog("PostgreSQL is already installed, skipping installation.\n");
      return;
    }
    
    // Clean up any stale locks (ignore errors)
    await this.ssh.exec("sudo rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock* 2>/dev/null || true", onLog);
    await this.ssh.exec("sudo dpkg --configure -a 2>/dev/null || true", onLog);
    
    // Kill any running apt processes that might hold locks
    await this.ssh.exec("sudo killall apt apt-get 2>/dev/null || true", onLog);
    
    // Wait a moment for locks to be released
    await this.ssh.exec("sleep 2", onLog);
    
    // Update package list
    const updateResult = await this.ssh.exec("sudo apt update -y 2>&1", onLog);
    if (updateResult.exitCode !== 0) {
      if (onLog) onLog(`Warning: apt update returned ${updateResult.exitCode}. Output: ${updateResult.output}\n`);
    }
    
    // Install PostgreSQL with DEBIAN_FRONTEND to avoid interactive prompts
    const installResult = await this.ssh.exec(
      "sudo DEBIAN_FRONTEND=noninteractive apt install -y postgresql postgresql-contrib 2>&1",
      onLog
    );
    
    if (installResult.exitCode !== 0) {
      // Log the full output for debugging
      console.error("PostgreSQL installation failed. Full output:", installResult.output);
      throw new Error(`PostgreSQL installation failed with exit code ${installResult.exitCode}: ${installResult.output.slice(-500)}`);
    }
  }

  async checkStatus(): Promise<boolean> {
    const result = await this.ssh.exec("sudo systemctl is-active postgresql");
    return result.output.trim() === "active";
  }

  async start(onLog?: (chunk: string) => void): Promise<void> {
    await this.ssh.exec("sudo systemctl start postgresql", onLog);
  }
  async createDatabase(database: string, onLog?: (chunk: string) => void) {
    const dbExists = await this.ssh.exec(
      `sudo -u postgres psql -lqt | cut -d \\| -f 1 | grep -qw ${database} && echo "1" || echo "0"`
    );
    if (dbExists.output.trim() === "0") {
      await this.ssh.exec(`sudo -u postgres createdb ${database}`, onLog);
    }
    throw new Error("Database already exists");
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

    if (dbExists.output.trim() === "0") {
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

  async executeSql(
    sql: string,
    username: string,
    database: string,
    onLog?: (chunk: string) => void
  ) {
    // Validate inputs
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      throw new Error("Invalid username");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
      throw new Error("Invalid database name");
    }

    // Basic SQL validation (prevent obvious injection)
    if (sql.includes(";") && !sql.trim().endsWith(";")) {
      throw new Error("Multiple SQL statements not allowed");
    }

    // Execute SQL
    const result = await this.ssh.exec(
      `sudo -u postgres psql -d ${database} -c "${sql.replace(/"/g, '\\"')}" --csv`,
      onLog
    );

    // Check for errors
    if (result.exitCode !== 0) {
      throw new Error(`SQL execution failed: ${result.output}`);
    }

    // Parse CSV output
    const parsed = Papa.parse(result.output.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    return parsed.data;
  }

  async executeSQLFile(
    sqlContent: string,
    database: string = "postgres",
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

    await this.ssh.runSequential(
      [
        // Backup original configs
        `sudo cp /etc/postgresql/${version}/main/postgresql.conf /etc/postgresql/${version}/main/postgresql.conf.bak`,
        `sudo cp /etc/postgresql/${version}/main/pg_hba.conf /etc/postgresql/${version}/main/pg_hba.conf.bak`,

        // Update postgresql.conf
        `sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/${version}/main/postgresql.conf`,

        // Add remote access to pg_hba.conf
        `echo "host    all             all             0.0.0.0/0               scram-sha-256" | sudo tee -a /etc/postgresql/${version}/main/pg_hba.conf`,

        // Restart PostgreSQL
        "sudo systemctl restart postgresql",
      ],
      onLog
    );
  }
  async dropDatabase(
    databaseName: string,
    onLog?: (chunk: string) => void
  ): Promise<void> {
    // Step 1: Terminate all connections to the database
    await this.ssh.exec(
      `sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();"`,
      onLog
    );

    // Step 2: Drop the database
    await this.ssh.exec(
      `sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${databaseName};"`,
      onLog
    );
  }
  async getTablesList(
    databaseName: string,
    onLog?: (chunk: string) => void
  ): Promise<string[]> {
    const tables = await this.ssh.exec(
      `sudo -u postgres psql -d ${databaseName} -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"`,
      onLog
    );
    const tablesList = tables.output.trim().split("\n");
    return tablesList.map((table) => table.trim());
  }
  async getTableData(
    databaseName: string,
    tableName: string,
    username: string,
    onLog?: (chunk: string) => void
  ) {
    // INSERT_YOUR_CODE
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error("Invalid table name");
    }
    const result = await this.ssh.exec(
      `sudo -u postgres psql -d ${databaseName} -c "SELECT * FROM \"${tableName}\";" --csv`,
      onLog
    );
    if (result.exitCode !== 0) {
      throw new Error(`Database query failed: ${result.output}`);
    }
    const parsed = await Papa.parse(result.output.trim(), {
      header: true, // First row as headers
      skipEmptyLines: true,
      dynamicTyping: true, // Auto-convert numbers/booleans
    });
    return parsed.data;
  }
  async accessBackupSafely(
    originalDatabase: string,
    username: string,
    backupPath: string = "./postgresBackup",
    onLog?: (chunk: string) => void
  ): Promise<string> {
    const tempDbName = `temp_${originalDatabase}_${Date.now()}`;

    try {
      // 1. Create temporary database
      await this.ssh.exec(
        `sudo -u postgres psql -U ${username} -c "CREATE DATABASE ${tempDbName};"`,
        onLog
      );

      // 2. Restore backup to temp database
      if (backupPath.endsWith(".dump")) {
        // Custom format
        await this.ssh.exec(
          `sudo -u postgres pg_restore -U ${username} -d ${tempDbName} ${backupPath}`,
          onLog
        );
      } else {
        // Plain SQL format
        await this.ssh.exec(
          `sudo -u postgres psql -U ${username} ${tempDbName} < ${backupPath}`,
          onLog
        );
      }

      console.log(`✅ Backup restored to temporary database: ${tempDbName}`);
      console.log(
        `Access it with: getTableData('${tempDbName}', 'tablename', 'username')`
      );

      return tempDbName;
    } catch (error) {
      // Cleanup on failure
      await this.ssh.exec(
        `sudo -u postgres psql -U ${username} -c "DROP DATABASE IF EXISTS ${tempDbName};"`,
        onLog
      );
      throw error;
    }
  }
  /**
   * Basic database backup
   */
  async backupDatabase(
    database: string,
    username: string,
    outputPath: string = "./postgresBackup",
    onLog?: (chunk: string) => void
  ): Promise<CommandResult> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
      throw new Error("Invalid database name");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      throw new Error("Invalid username");
    }

    return await this.ssh.exec(
      `sudo -u postgres pg_dump -U ${username} ${database} > ${outputPath}`,
      onLog
    );
  }
}
