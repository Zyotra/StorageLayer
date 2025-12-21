import Papa from "papaparse";
import SSHClient from "../SSHClient/SSHClient";

interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
}

interface DatabaseInfo {
  name: string;
  size: string;
}

interface TableInfo {
  name: string;
  rows: number;
  size: string;
}

class MySQLHelper {
  private ssh: SSHClient;

  constructor(ssh: SSHClient) {
    this.ssh = ssh;
  }

  /**
   * Validate input to prevent SQL injection
   */
  private validateIdentifier(identifier: string, name: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid ${name}: ${identifier}`);
    }
  }

  async installMySQL(onLog?: (chunk: string) => void): Promise<void> {
    await this.ssh.runSequential(
      [
        // Update package index
        `sudo apt update`,

        // Install MySQL Server
        `sudo DEBIAN_FRONTEND=noninteractive apt install -y mysql-server`,

        // Start MySQL service
        `sudo systemctl start mysql`,

        // Enable MySQL to start on boot
        `sudo systemctl enable mysql`,

        // Check MySQL status
        `sudo systemctl status mysql --no-pager`,
      ],
      onLog
    );
  }

  async setupMySQL(
    rootPassword: string,
    appUsername: string,
    appPassword: string,
    databaseName: string,
    onLog?: (chunk: string) => void
  ): Promise<{
    success: boolean;
    existingInstallation: boolean;
    message: string;
  }> {
    // 1. Check if MySQL is already installed and configured
    const statusCheck = await this.ssh.exec(
      `sudo systemctl is-active mysql 2>/dev/null`,
      onLog
    );
    const existingInstallation =
      statusCheck.exitCode === 0 && statusCheck.output.trim() === "active";

    if (existingInstallation) {
      console.log("MySQL is already running. Checking configuration...");

      // Try to connect with provided root password
      const authCheck = await this.ssh.exec(
        `mysql -u root -p'${rootPassword}' -e "SELECT 1;" 2>&1`,
        onLog
      );

      if (authCheck.exitCode !== 0) {
        // Root password doesn't match - ask user what to do
        throw new Error(
          "'MySQL is already installed with a different root password. Please provide the correct password or reset it manually."
        );
      }

      // Password is correct, proceed with database/user creation only
      await this.ssh.runSequential(
        [
          // Create database if doesn't exist
          `mysql -u root -p'${rootPassword}' -e "CREATE DATABASE IF NOT EXISTS ${databaseName};"`,

          // Create user if doesn't exist
          `mysql -u root -p'${rootPassword}' -e "CREATE USER IF NOT EXISTS '${appUsername}'@'localhost' IDENTIFIED BY '${appPassword}';"`,

          // Grant privileges
          `mysql -u root -p'${rootPassword}' -e "GRANT ALL PRIVILEGES ON ${databaseName}.* TO '${appUsername}'@'localhost';"`,

          // Flush privileges
          `mysql -u root -p'${rootPassword}' -e "FLUSH PRIVILEGES;"`,
        ],
        onLog
      );

      return {
        success: true,
        existingInstallation: true,
        message: `Database '${databaseName}' and user '${appUsername}' created successfully on existing MySQL installation.`,
      };
    }

    // 2. Fresh installation
    await this.ssh.runSequential(
      [
        // Update system
        `sudo apt update`,

        // Install MySQL Server
        `sudo DEBIAN_FRONTEND=noninteractive apt install -y mysql-server`,

        // Start MySQL
        `sudo systemctl start mysql`,

        // Enable on boot
        `sudo systemctl enable mysql`,

        // Wait for MySQL to be ready
        `sudo mysqladmin ping -h localhost --wait=30 || echo "Waiting for MySQL..."`,

        // Secure installation & set root password
        `sudo mysql << 'EOF'
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${rootPassword}';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF`,

        // Create database
        `mysql -u root -p'${rootPassword}' -e "CREATE DATABASE IF NOT EXISTS ${databaseName};"`,

        // Create user
        `mysql -u root -p'${rootPassword}' -e "CREATE USER IF NOT EXISTS '${appUsername}'@'localhost' IDENTIFIED BY '${appPassword}';"`,

        // Grant privileges
        `mysql -u root -p'${rootPassword}' -e "GRANT ALL PRIVILEGES ON ${databaseName}.* TO '${appUsername}'@'localhost';"`,

        // Flush privileges
        `mysql -u root -p'${rootPassword}' -e "FLUSH PRIVILEGES;"`,

        // Verify
        `mysql -u ${appUsername} -p'${appPassword}' -e "SELECT 'MySQL setup successful!' as status;"`,
      ],
      onLog
    );

    return {
      success: true,
      existingInstallation: false,
      message: `MySQL installed successfully. Database '${databaseName}' and user '${appUsername}' created.`,
    };
  }

  async createMySQLUser(
    username: string,
    password: string,
    database?: string,
    onLog?: (chunk: string) => void
  ): Promise<void> {
    // Validate inputs
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
      throw new Error("Invalid username");
    }
    if (database && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
      throw new Error("Invalid database name");
    }

    const commands = [
      // Create database if specified
      ...(database
        ? [`sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${database};"`]
        : []),

      // Create user
      `sudo mysql -e "CREATE USER IF NOT EXISTS '${username}'@'localhost' IDENTIFIED BY '${password}';"`,

      // Grant privileges
      ...(database
        ? [
            `sudo mysql -e "GRANT ALL PRIVILEGES ON ${database}.* TO '${username}'@'localhost';"`,
          ]
        : [
            `sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO '${username}'@'localhost';"`,
          ]),

      // Flush privileges
      `sudo mysql -e "FLUSH PRIVILEGES;"`,
    ];

    await this.ssh.runSequential(commands, onLog);
  }
  /**
   * List all MySQL databases
   */
  async listDatabases(
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<DatabaseInfo[]> {
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -e "SELECT table_schema as name, ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb FROM information_schema.tables GROUP BY table_schema;" --batch --skip-column-names`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list databases: ${result.output}`);
    }

    const lines = result.output.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const [name, size] = line.split("\t");
      return { name, size: `${size} MB` };
    });
  }

  /**
   * List all tables in a database
   */
  async listTables(
    database: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<string[]> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SHOW TABLES;" --batch --skip-column-names`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list tables: ${result.output}`);
    }

    return result.output
      .trim()
      .split("\n")
      .map((table) => table.trim())
      .filter(Boolean);
  }

  /**
   * Get detailed table information
   */
  async getTableInfo(
    database: string,
    tableName: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<TableInfo> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(tableName, "table");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SELECT COUNT(*) as rows, ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb FROM information_schema.tables WHERE table_schema = '${database}' AND table_name = '${tableName}';" --batch --skip-column-names`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get table info: ${result.output}`);
    }

    const [rows, size] = result.output.trim().split("\t");
    return {
      name: tableName,
      rows: parseInt(rows) || 0,
      size: `${size} MB`,
    };
  }

  /**
   * Get table data with CSV parsing
   */
  async getTableData(
    database: string,
    tableName: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<any[]> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(tableName, "table");
    this.validateIdentifier(username, "username");

    // Verify table exists
    const tables = await this.listTables(database, username, password);
    if (!tables.includes(tableName)) {
      throw new Error(`Table '${tableName}' not found or access denied`);
    }

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SELECT * FROM \\\`${tableName}\\\`;" --batch`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get table data: ${result.output}`);
    }

    // MySQL --batch output is tab-separated
    const parsed = Papa.parse(result.output.trim(), {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    return parsed.data;
  }

  /**
   * Get table data with pagination
   */
  async getTableDataPaginated(
    database: string,
    tableName: string,
    username: string,
    password: string,
    limit: number = 100,
    offset: number = 0,
    onLog?: (chunk: string) => void
  ): Promise<{ data: any[]; total: number }> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(tableName, "table");
    this.validateIdentifier(username, "username");

    // Get total count
    const countResult = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SELECT COUNT(*) FROM \\\`${tableName}\\\`;" --batch --skip-column-names`,
      onLog
    );

    if (countResult.exitCode !== 0) {
      throw new Error(`Failed to count rows: ${countResult.output}`);
    }

    const total = parseInt(countResult.output.trim());

    // Get paginated data
    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SELECT * FROM \\\`${tableName}\\\` LIMIT ${limit} OFFSET ${offset};" --batch`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get table data: ${result.output}`);
    }

    const parsed = Papa.parse(result.output.trim(), {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    return {
      data: parsed.data,
      total,
    };
  }

  /**
   * Execute custom SQL query (SELECT only for security)
   */
  async executeQuery(
    database: string,
    sql: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<any[]> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(username, "username");

    // Only allow SELECT queries
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    // Prevent multiple statements
    const statements = sql.split(";").filter((s) => s.trim());
    if (statements.length > 1) {
      throw new Error("Multiple statements not allowed");
    }

    // Execute query using heredoc to avoid escaping issues
    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} --batch << 'EOF'
${sql}
EOF`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Query execution failed: ${result.output}`);
    }

    const parsed = Papa.parse(result.output.trim(), {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    return parsed.data;
  }

  /**
   * Get table schema/structure
   */
  async getTableSchema(
    database: string,
    tableName: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<any[]> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(tableName, "table");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "DESCRIBE \\\`${tableName}\\\`;" --batch`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get table schema: ${result.output}`);
    }

    const parsed = Papa.parse(result.output.trim(), {
      header: true,
      delimiter: "\t",
      skipEmptyLines: true,
    });

    return parsed.data;
  }

  /**
   * Check if database exists
   */
  async databaseExists(
    database: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<boolean> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${database}';" --batch --skip-column-names`,
      onLog
    );

    return result.exitCode === 0 && result.output.trim() === database;
  }

  /**
   * Check if table exists
   */
  async tableExists(
    database: string,
    tableName: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<boolean> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(tableName, "table");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -D ${database} -e "SHOW TABLES LIKE '${tableName}';" --batch --skip-column-names`,
      onLog
    );

    return result.exitCode === 0 && result.output.trim() === tableName;
  }

  /**
   * Get MySQL version
   */
  async getVersion(
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<string> {
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -e "SELECT VERSION();" --batch --skip-column-names`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get MySQL version: ${result.output}`);
    }

    return result.output.trim();
  }

  /**
   * Test database connection
   */
  async testConnection(
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<boolean> {
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -e "SELECT 1;" --batch --skip-column-names`,
      onLog
    );

    return result.exitCode === 0 && result.output.trim() === "1";
  }

  /**
   * Create database backup (mysqldump)
   */
  async backupDatabase(
    database: string,
    username: string,
    password: string,
    outputPath: string="./MySQLBackup",
    onLog?: (chunk: string) => void
  ): Promise<CommandResult> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(username, "username");

    return await this.ssh.exec(
      `mysqldump -u ${username} -p'${password}' ${database} > ${outputPath}`,
      onLog
    );
  }

  /**
   * Get database size
   */
  async getDatabaseSize(
    database: string,
    username: string,
    password: string,
    onLog?: (chunk: string) => void
  ): Promise<string> {
    this.validateIdentifier(database, "database");
    this.validateIdentifier(username, "username");

    const result = await this.ssh.exec(
      `mysql -u ${username} -p'${password}' -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as size_mb FROM information_schema.tables WHERE table_schema = '${database}';" --batch --skip-column-names`,
      onLog
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get database size: ${result.output}`);
    }

    return `${result.output.trim()} MB`;
  }
  async accessBackupSafely(
    originalDatabase: string,
    username: string,
    password: string,
    backupPath: string,
    onLog?: (chunk: string) => void
  ): Promise<string> {
    const tempDbName = `temp_${originalDatabase}_${Date.now()}`;

    try {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(originalDatabase)) {
        throw new Error("Invalid table name");
      }
      // 1. Create temporary database
      await this.ssh.exec(
        `mysql -u ${username} -p'${password}' -e "CREATE DATABASE ${tempDbName};"`,
        onLog
      );

      // 2. Restore backup to temp database
      await this.ssh.exec(
        `mysql -u ${username} -p'${password}' ${tempDbName} < ${backupPath}`,
        onLog
      );

      console.log(`✅ Backup restored to temporary database: ${tempDbName}`);
      return tempDbName;
    } catch (error) {
      // Cleanup on failure
      await this.ssh.exec(
        `mysql -u ${username} -p'${password}' -e "DROP DATABASE IF EXISTS ${tempDbName};"`,
        onLog
      );
      throw error;
    }
  }
  /*
   * Delete database during invalid operations
   */
  async dropDatabase(
    username: string,
    password: string,
    databaseName: string,
    onLog?: (chunk: string) => void
  ) {
    try {
      const result = await this.ssh.exec(
        `mysql -u ${username} -p${password} -e "DROP DATABASE IF EXISTS ${databaseName};" || true`,
        onLog
      );
    } catch (error) {
        throw new Error(`Error while dropping the database: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export default MySQLHelper;
