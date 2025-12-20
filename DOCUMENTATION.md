# StorageLayer - Complete Technical Documentation

## Table of Contents

1. [API Routes](#api-routes)
2. [Functions](#functions)
3. [Command Deep-Dive](#command-deep-dive)
4. [Security Analysis](#security-analysis)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Database Schema](#database-schema)

---

## API Routes

### 1. GET `/`

**Purpose**: Health check endpoint to verify service availability

**HTTP Method**: GET

**Authentication**: None (Public endpoint)

**Request Parameters**: None

**Response Format**:
```json
{
  "status": "success",
  "message": "Storage Layer of Zyotra is running",
  "Timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Database Operations**: None

**External Services**: None

---

### 2. POST `/deploy-postgres`

**Purpose**: Deploys PostgreSQL database on a remote VPS machine. Installs PostgreSQL if not present, creates database and user, configures remote access, and stores metadata.

**HTTP Method**: POST

**Authentication**: Protected by `checkAuth` middleware (JWT token required)

**Request Parameters**:
- **Body**:
  ```typescript
  {
    vpsId: string;      // VPS machine ID
    vpsIp: string;      // VPS machine IP address
    dbName: string;     // Database name to create
    userName: string;   // PostgreSQL username
    password: string;   // PostgreSQL password
  }
  ```

**Response Format**:
- **Success (200)**:
  ```json
  {
    "status": 200,
    "message": "Postgres deployment started successfully"
  }
  ```
- **Error (400)**: Invalid request body or database already exists
- **Error (403)**: Unauthorized access to machine
- **Error (500)**: Internal server error

**Database Operations**:
- **Read**: Queries `deployed_db` table to check for existing database
- **Write**: Inserts new record into `deployed_db` table

**External Services**:
- SSH connection to remote VPS
- PostgreSQL installation and configuration commands
- External database query for VPS machine verification

**Logic Flow**:
1. Validate request body parameters
2. Verify machine ownership via `verifyMachine()`
3. Check if database already exists on the machine
4. Decrypt VPS password
5. Establish SSH connection
6. Install PostgreSQL (if not installed)
7. Start PostgreSQL service
8. Create database user and database
9. Configure remote access
10. Store deployment metadata in database
11. Clean up SSH connection

**Error Handling**:
- If deployment fails, attempts to drop the created database
- Always closes SSH connection in `finally` block
- Returns appropriate HTTP status codes

---

### 3. DELETE `/delete-db/:id`

**Purpose**: Deletes a PostgreSQL database from a remote VPS machine and removes its metadata.

**HTTP Method**: DELETE

**Authentication**: Protected by `checkAuth` middleware

**Request Parameters**:
- **Path**: `id` (database ID from metadata table)
- **Body**: Not used (but code expects body with dbName, vpsIp, vpsId - potential bug)

**Response Format**:
- **Success (200)**:
  ```json
  {
    "status": 200,
    "message": "Database deleted successfully"
  }
  ```
- **Error (400)**: Database ID missing
- **Error (404)**: Database not found
- **Error (403)**: Unauthorized access to machine
- **Error (500)**: Internal server error

**Database Operations**:
- **Read**: Queries `deployed_db` table by ID to get database details
- **Delete**: Removes record from `deployed_db` table

**External Services**:
- SSH connection to remote VPS
- PostgreSQL commands to terminate connections and drop database

**Logic Flow**:
1. Extract database ID from path parameters
2. Query database metadata by ID
3. Verify machine ownership
4. Decrypt VPS password
5. Establish SSH connection
6. Terminate all connections to the database
7. Drop the database
8. Delete metadata record
9. Close SSH connection

**Security Considerations**:
- Verifies user owns the VPS before deletion
- Ensures all connections are terminated before dropping database

---

### 4. GET `/get-db`

**Purpose**: Retrieves list of all databases deployed by the authenticated user.

**HTTP Method**: GET

**Authentication**: Protected by `checkAuth` middleware

**Request Parameters**: None (uses `userId` from JWT token)

**Response Format**:
- **Success (200)**:
  ```json
  {
    "status": 200,
    "data": [
      {
        "id": 1,
        "dbName": "mydb",
        "username": "dbuser",
        "host": "192.168.1.1",
        "dbType": "postgres",
        "vpsId": 1,
        "userId": 1,
        "status": "running",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
  ```
- **Error (500)**: Database query failed

**Database Operations**:
- **Read**: Selects all records from `deployed_db` where `userId` matches authenticated user

**External Services**: None

**Logic Flow**:
1. Extract `userId` from JWT token (via middleware)
2. Query `deployed_db` table filtered by `userId`
3. Return results

---

### 5. POST `/get-tables-list`

**Purpose**: Retrieves list of all tables in a specific database on a remote VPS.

**HTTP Method**: POST

**Authentication**: Protected by `checkAuth` middleware

**Request Parameters**:
- **Body**:
  ```typescript
  {
    databaseName: string;  // Name of the database
    vpsId: string;         // VPS machine ID
    vpsIp: string;         // VPS machine IP address
    username: string;       // PostgreSQL username
  }
  ```

**Response Format**:
- **Success (200)**:
  ```json
  {
    "status": 200,
    "data": ["users", "products", "orders"],
    "message": "Tables list fetched successfully"
  }
  ```
- **Error (400)**: Invalid request body
- **Error (403)**: Unauthorized access to machine
- **Error (500)**: Internal server error

**Database Operations**: None (only queries remote PostgreSQL)

**External Services**:
- SSH connection to remote VPS
- PostgreSQL query to `information_schema.tables`

**Logic Flow**:
1. Validate request body
2. Verify machine ownership
3. Decrypt VPS password
4. Establish SSH connection
5. Execute PostgreSQL query to get table names
6. Parse and filter table names
7. Return cleaned list
8. Close SSH connection

---

### 6. POST `/get-table-data`

**Purpose**: Retrieves all data from a specific table in a remote database, returned as CSV-parsed JSON.

**HTTP Method**: POST

**Authentication**: Protected by `checkAuth` middleware

**Request Parameters**:
- **Body**:
  ```typescript
  {
    databaseName: string;  // Name of the database
    vpsId: string;         // VPS machine ID
    vpsIp: string;         // VPS machine IP address
    tableName: string;     // Name of the table
    username: string;      // PostgreSQL username
  }
  ```

**Response Format**:
- **Success (200)**:
  ```json
  {
    "status": "success",
    "data": [
      {"id": 1, "name": "John", "email": "john@example.com"},
      {"id": 2, "name": "Jane", "email": "jane@example.com"}
    ]
  }
  ```
- **Error (400)**: Invalid request body
- **Error (404)**: Invalid machine details or unauthorized
- **Error (500)**: Internal server error

**Database Operations**: None (only queries remote PostgreSQL)

**External Services**:
- SSH connection to remote VPS
- PostgreSQL query with CSV output
- PapaParse for CSV parsing

**Logic Flow**:
1. Validate request body
2. Verify machine ownership
3. Decrypt VPS password
4. Establish SSH connection
5. Validate table name (alphanumeric + underscore only)
6. Execute PostgreSQL query with CSV output
7. Parse CSV response into JSON
8. Return parsed data
9. Close SSH connection

**Security Considerations**:
- Table name validation prevents SQL injection
- Uses parameterized queries through shell escaping

---

## Functions

### Middleware Functions

#### `checkAuth` (src/middlewares/checkAuth.ts)

**Purpose**: Validates JWT access token and extracts user ID for protected routes.

**Parameters**:
- `headers`: Request headers (not used, but available)
- `cookie`: Request cookies containing `accessToken`
- `set`: Elysia context setter for status codes

**Return Value**:
- On success: `{ userId: string }`
- On failure: Sets status code and returns error message

**Logic Flow**:
1. Extract `accessToken` from cookies
2. If token missing, return 419 status with error message
3. Verify token using `verifyAccessToken()`
4. If invalid, return 419 status
5. Extract `userId` from verified token payload
6. Return `userId` for use in route handlers

**Error Handling**:
- Missing token → 419 (EXPIRED_TOKEN)
- Invalid token → 419 (EXPIRED_TOKEN)
- Missing userId → 419 (EXPIRED_TOKEN)

**Dependencies**:
- `verifyAccessToken()` from `src/jwt/verifyTokens.ts`
- `StatusCode` enum from `src/types/types.ts`

---

### Controller Functions

#### `deployPostgresController` (src/controllers/deploy-postgres.ts)

**Purpose**: Orchestrates PostgreSQL deployment on remote VPS machine.

**Parameters**:
- `body`: Request body containing deployment configuration
- `set`: Elysia context setter
- `userId`: Extracted from JWT token via middleware

**Return Value**:
- Success: `{ status: 200, message: string }`
- Error: `{ status: number, message: string }`

**Logic Flow**:
1. Extract and validate request parameters
2. Verify machine ownership via `verifyMachine()`
3. Check for existing database on same host/name
4. Decrypt VPS password
5. Create SSH client and connect
6. Create PostgresSSHHelper instance
7. Install PostgreSQL (if needed)
8. Start PostgreSQL service
9. Create user and database
10. Configure remote access
11. Insert metadata into database
12. Return success response
13. On error: attempt to drop database, close SSH

**Error Handling**:
- Validation errors → 400
- Authorization errors → 403
- Deployment errors → 500 with cleanup

**Dependencies**:
- `verifyMachine()`, `decryptPassword()`, `SSHClient`, `PostgresSSHHelper`, `db`, `deployed_db`

---

#### `deleteDatabaseController` (src/controllers/deleteDatabaseController.ts)

**Purpose**: Deletes a PostgreSQL database from remote VPS and removes metadata.

**Parameters**:
- `params`: Route parameters containing `id`
- `body`: Request body (declared but not used - potential bug)
- `set`: Elysia context setter
- `userId`: Extracted from JWT token

**Return Value**:
- Success: `{ status: 200, message: string }`
- Error: `{ status: number, message: string }`

**Logic Flow**:
1. Extract database ID from params
2. Query database metadata by ID
3. Verify database exists
4. Verify machine ownership
5. Decrypt VPS password
6. Establish SSH connection
7. Drop database via PostgresSSHHelper
8. Delete metadata record
9. Close SSH connection

**Error Handling**:
- Missing ID → 400
- Database not found → 404
- Authorization error → 403
- Execution error → 500

**Dependencies**:
- `verifyMachine()`, `decryptPassword()`, `SSHClient`, `PostgresSSHHelper`, `db`, `deployed_db`

---

#### `getdbController` (src/controllers/getdbController.ts)

**Purpose**: Retrieves all databases for authenticated user.

**Parameters**:
- `set`: Elysia context setter
- `userId`: Extracted from JWT token

**Return Value**:
- Success: `{ status: 200, data: DeployedDb[] }`
- Error: `{ status: 500, message: any }`

**Logic Flow**:
1. Query `deployed_db` table filtered by `userId`
2. Return results with 200 status
3. On error, return 500 status

**Dependencies**:
- `db`, `deployed_db` schema, `eq` from drizzle-orm

---

#### `getTablesListController` (src/controllers/getTablesListController.ts)

**Purpose**: Retrieves list of tables from remote database.

**Parameters**:
- `body`: Request body with database and VPS details
- `set`: Elysia context setter
- `userId`: Extracted from JWT token

**Return Value**:
- Success: `{ status: 200, data: string[], message: string }`
- Error: `{ status: number, message: string }`

**Logic Flow**:
1. Validate request body
2. Verify machine ownership
3. Decrypt VPS password
4. Establish SSH connection
5. Get tables list via PostgresSSHHelper
6. Parse table names
7. Return cleaned list
8. Close SSH connection

**Dependencies**:
- `verifyMachine()`, `decryptVpsPassword()`, `SSHClient`, `PostgresSSHHelper`, `parseTableNames()`

---

#### `getTableData` (src/controllers/getTableData.ts)

**Purpose**: Retrieves data from a specific table in remote database.

**Parameters**:
- `body`: Request body with database, table, and VPS details
- `set`: Elysia context setter
- `userId`: Extracted from JWT token

**Return Value**:
- Success: `{ status: "success", data: any[] }`
- Error: `{ message: any }`

**Logic Flow**:
1. Validate request body
2. Verify machine ownership
3. Decrypt VPS password
4. Establish SSH connection
5. Get table data via PostgresSSHHelper (includes validation)
6. Return parsed CSV data
7. Close SSH connection

**Dependencies**:
- `verifyMachine()`, `decryptVpsPassword()`, `SSHClient`, `PostgresSSHHelper`

---

### Helper Class Functions

#### `PostgresSSHHelper` (src/HelperClasses/PostgresHelper.ts)

**Purpose**: Provides high-level PostgreSQL management operations via SSH.

**Constructor**:
- `ssh: SSHClient` - SSH client instance for command execution

---

#### `install()` (PostgresSSHHelper)

**Purpose**: Installs PostgreSQL and contrib packages on remote machine.

**Parameters**:
- `onLog?: (chunk: string) => void` - Optional callback for real-time output

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Run `sudo apt update` to refresh package list
2. Run `sudo apt install -y postgresql postgresql-contrib` to install PostgreSQL

**Commands Executed**:
- `sudo apt update` - Updates package repository index
- `sudo apt install -y postgresql postgresql-contrib` - Installs PostgreSQL server and contrib modules

**Error Handling**: Throws error if any command fails (via `runSequential`)

---

#### `checkStatus()` (PostgresSSHHelper)

**Purpose**: Checks if PostgreSQL service is running.

**Parameters**: None

**Return Value**: `Promise<boolean>` - true if active, false otherwise

**Logic Flow**:
1. Execute `systemctl is-active postgresql`
2. Check if output equals "active"
3. Return boolean result

**Commands Executed**:
- `sudo systemctl is-active postgresql` - Returns "active" if service is running, "inactive" otherwise

---

#### `start()` (PostgresSSHHelper)

**Purpose**: Starts PostgreSQL service.

**Parameters**:
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Commands Executed**:
- `sudo systemctl start postgresql` - Starts PostgreSQL service

---

#### `createDatabase()` (PostgresSSHHelper)

**Purpose**: Creates a PostgreSQL database (NOTE: Has bug - throws error if database doesn't exist).

**Parameters**:
- `database: string` - Database name
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Check if database exists using grep
2. If doesn't exist (output "0"), create database
3. If exists, throw error (BUG: logic is inverted)

**Commands Executed**:
- `sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ${database} && echo "1" || echo "0"` - Checks database existence
- `sudo -u postgres createdb ${database}` - Creates database

**Bug**: Logic is inverted - should create if output is "0", but throws error instead.

---

#### `createUserAndDatabase()` (PostgresSSHHelper)

**Purpose**: Creates PostgreSQL user and database, grants privileges.

**Parameters**:
- `config: PostgresConfig` - `{ database, username?, password }`
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Check if user exists via `pg_roles` query
2. If user doesn't exist, create user with password
3. Check if database exists
4. If database doesn't exist, create database with owner
5. Grant all privileges on database to user

**Commands Executed**:
- `sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${username}'"` - Checks user existence
- `sudo -u postgres psql -c "CREATE USER ${username} WITH PASSWORD '${password}';"` - Creates user
- `sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ${database} && echo "1" || echo "0"` - Checks database existence
- `sudo -u postgres psql -c "CREATE DATABASE ${database} OWNER ${username};"` - Creates database
- `sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${username};"` - Grants privileges

**Security Considerations**:
- Password is passed in command string (potential security risk)
- Uses `sudo -u postgres` to run commands as postgres user

---

#### `executeSQL()` (PostgresSSHHelper)

**Purpose**: Executes a single SQL command on remote database.

**Parameters**:
- `sql: string` - SQL command to execute
- `database: string` - Database name (default: "postgres")
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<CommandResult>` - Command execution result

**Logic Flow**:
1. Escape double quotes in SQL string
2. Execute SQL via psql command
3. Return result

**Commands Executed**:
- `sudo -u postgres psql -d ${database} -c "${escapedSQL}"` - Executes SQL command

**Security Considerations**:
- Escapes double quotes but doesn't prevent all SQL injection
- Should use parameterized queries or file-based execution for user input

---

#### `executeSQLFile()` (PostgresSSHHelper)

**Purpose**: Executes SQL from a file on remote machine.

**Parameters**:
- `sqlContent: string` - SQL file content
- `database: string` - Database name
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Create temporary file path with timestamp
2. Write SQL content to temp file using heredoc
3. Execute SQL file via psql
4. Delete temporary file

**Commands Executed**:
- `cat > ${tmpFile} << 'EOSQL' ... EOSQL` - Writes SQL to temp file
- `sudo -u postgres psql -d ${database} -f ${tmpFile}` - Executes SQL file
- `rm ${tmpFile}` - Deletes temp file

**Security Considerations**:
- Uses heredoc with single quotes to prevent variable expansion
- Cleans up temp file after execution

---

#### `allowRemoteConnections()` (PostgresSSHHelper)

**Purpose**: Configures PostgreSQL to accept remote connections.

**Parameters**:
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Find PostgreSQL version directory
2. Backup original configuration files
3. Update `postgresql.conf` to listen on all addresses
4. Add remote access rule to `pg_hba.conf`
5. Restart PostgreSQL service

**Commands Executed**:
- `ls /etc/postgresql/ | head -n 1` - Gets PostgreSQL version
- `sudo cp /etc/postgresql/${version}/main/postgresql.conf ...bak` - Backs up config
- `sudo cp /etc/postgresql/${version}/main/pg_hba.conf ...bak` - Backs up pg_hba
- `sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" ...` - Enables remote listening
- `echo "host all all 0.0.0.0/0 scram-sha-256" | sudo tee -a ...` - Adds remote access rule
- `sudo systemctl restart postgresql` - Restarts service

**Security Considerations**:
- Opens PostgreSQL to all IPs (0.0.0.0/0) - security risk
- Uses scram-sha-256 authentication (secure)
- Backs up original configs before modification

---

#### `dropDatabase()` (PostgresSSHHelper)

**Purpose**: Drops a PostgreSQL database, terminating all connections first.

**Parameters**:
- `databaseName: string` - Database to drop
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Terminate all active connections to database
2. Drop database

**Commands Executed**:
- `sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();"` - Terminates connections
- `sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${databaseName};"` - Drops database

**Security Considerations**:
- Excludes current connection from termination
- Uses `IF EXISTS` to prevent errors if database doesn't exist

---

#### `getTablesList()` (PostgresSSHHelper)

**Purpose**: Retrieves list of table names from a database.

**Parameters**:
- `databaseName: string` - Database name
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<string[]>` - Array of table names

**Logic Flow**:
1. Query `information_schema.tables` for public schema tables
2. Split output by newlines
3. Trim each line
4. Return array

**Commands Executed**:
- `sudo -u postgres psql -d ${databaseName} -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"` - Gets table names

**Note**: Returns raw output including headers and formatting - should be parsed by `parseTableNames()`

---

#### `getTableData()` (PostgresSSHHelper)

**Purpose**: Retrieves all data from a table as CSV, parsed to JSON.

**Parameters**:
- `databaseName: string` - Database name
- `tableName: string` - Table name
- `username: string` - PostgreSQL username
- `onLog?: (chunk: string) => void`

**Return Value**: `Promise<any[]>` - Parsed CSV data as JSON array

**Logic Flow**:
1. Validate table name (alphanumeric + underscore only)
2. Execute SELECT query with CSV output
3. Check exit code
4. Parse CSV with PapaParse
5. Return parsed data

**Commands Executed**:
- `psql -U ${username} -d ${databaseName} -c "SELECT * FROM \"${tableName}\";" --csv` - Gets table data as CSV

**Security Considerations**:
- Validates table name with regex: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- Escapes table name in double quotes
- Uses CSV output for safe parsing

**Error Handling**:
- Invalid table name → throws Error
- Query failure → throws Error with output

**Dependencies**:
- PapaParse for CSV parsing

---

### Utility Functions

#### `verifyMachine()` (src/utils/verifyMachine.ts)

**Purpose**: Verifies that a VPS machine belongs to the authenticated user and IP matches.

**Parameters**:
- `machineId: string` - VPS machine ID
- `userId: string` - Authenticated user ID
- `machineIp: string` - Expected VPS IP address

**Return Value**:
```typescript
{
  status: boolean;
  machine: any | null;
}
```

**Logic Flow**:
1. Query `vps_machines` table for machine with matching ID and ownerId
2. If not found, return `{ status: false, machine: null }`
3. If found, verify IP address matches
4. Return status and machine object

**Database Operations**:
- Queries external `DEPLOYMENT_MANAGER_DATABASE_URL` database
- Table: `vps_machines`
- Columns: `id`, `ownerId`, `vps_ip`

**Security Considerations**:
- Uses parameterized query to prevent SQL injection
- Verifies both ownership and IP address

**Dependencies**:
- `pool` from `src/db/pool.ts`

---

#### `decryptVpsPassword()` / `decryptPassword()` (src/utils/decryptPassword.ts)

**Purpose**: Decrypts AES-encrypted VPS password.

**Parameters**:
- `encryptedPassword: string` - AES-encrypted password string

**Return Value**: `Promise<string>` - Decrypted password

**Logic Flow**:
1. Decrypt using CryptoJS.AES.decrypt with ENCRYPTION_KEY
2. Convert WordArray to UTF-8 string
3. Return decrypted password

**Security Considerations**:
- Uses AES encryption
- Encryption key from environment variable
- Returns plaintext password (handle with care)

**Dependencies**:
- CryptoJS library
- `process.env.ENCRYPTION_KEY`

---

#### `parseTableNames()` (src/utils/parseTableNames.ts)

**Purpose**: Cleans PostgreSQL psql output to extract only table names.

**Parameters**:
- `response: string[]` - Raw output lines from psql

**Return Value**: `string[]` - Cleaned array of table names

**Logic Flow**:
1. Trim each line
2. Filter out:
   - Header line ("table_name")
   - Separator lines (all dashes)
   - Footer lines (e.g., "(2 rows)")
   - Empty strings
3. Return filtered array

**Regex Patterns**:
- Separator: `/^-+$/` - Matches lines with only dashes
- Footer: `/^\(\d+\s+rows?\)$/i` - Matches "(N rows)" pattern

---

#### `verifyAccessToken()` (src/jwt/verifyTokens.ts)

**Purpose**: Verifies JWT access token and extracts user ID.

**Parameters**:
- `token: string` - JWT token string

**Return Value**: `Promise<{ userId: string } | false>`

**Logic Flow**:
1. Verify token using jsonwebtoken with ACCESS_TOKEN_SECRET
2. Extract userId from payload
3. Return userId or false on error

**Error Handling**:
- Invalid token → returns false
- Expired token → returns false
- Missing secret → throws error

**Dependencies**:
- jsonwebtoken library
- `process.env.ACCESS_TOKEN_SECRET`

---

### SSH Client Functions

#### `SSHClient` (src/SSHClient/SSHClient.ts)

**Purpose**: Wrapper around ssh2 library for executing commands on remote machines.

**Constructor**:
- `config: ConnectConfig` - SSH connection configuration (host, username, password, etc.)

---

#### `connect()` (SSHClient)

**Purpose**: Establishes SSH connection to remote machine.

**Return Value**: `Promise<void>`

**Logic Flow**:
1. Listen for 'ready' event → resolve
2. Listen for 'error' event → reject
3. Connect with provided config

**Error Handling**: Rejects promise on connection error

---

#### `exec()` (SSHClient)

**Purpose**: Executes a shell command on remote machine.

**Parameters**:
- `command: string` - Shell command to execute
- `onLog?: (chunk: string) => void` - Optional callback for real-time output

**Return Value**: `Promise<CommandResult>` - `{ command, output, exitCode }`

**Logic Flow**:
1. Execute command via SSH
2. Collect stdout chunks
3. Collect stderr chunks
4. Call onLog callback for each chunk
5. On stream close, resolve with result

**Error Handling**:
- Connection error → rejects promise
- Command execution error → rejects promise

**Note**: Includes artificial delays (`Bun.sleep(1)`) for output streaming

---

#### `runSequential()` (SSHClient)

**Purpose**: Executes multiple commands sequentially, stopping on first failure.

**Parameters**:
- `commands: string[]` - Array of commands to execute
- `onLog?: (chunk: string) => void` - Optional callback

**Return Value**: `Promise<CommandResult[]>` - Array of results

**Logic Flow**:
1. Execute each command sequentially
2. If any command fails (exitCode !== 0), throw error
3. Return array of results

**Error Handling**:
- Stops execution on first failure
- Throws error with command and exit code

---

#### `close()` (SSHClient)

**Purpose**: Closes SSH connection.

**Return Value**: `void`

**Logic Flow**: Calls `conn.end()` to close connection

---

## Command Deep-Dive

### PostgreSQL Installation Commands

#### `sudo apt update`
- **Purpose**: Refreshes package repository index
- **Why**: Ensures latest package versions are available
- **Flags**: None
- **Expected Output**: Package list update messages
- **Failure Scenarios**: Network issues, repository errors

#### `sudo apt install -y postgresql postgresql-contrib`
- **Purpose**: Installs PostgreSQL server and contrib modules
- **Why**: Required for PostgreSQL functionality
- **Flags**:
  - `-y`: Automatically answers "yes" to prompts
- **Packages**:
  - `postgresql`: Core PostgreSQL server
  - `postgresql-contrib`: Additional modules and utilities
- **Expected Output**: Installation progress and completion messages
- **Failure Scenarios**: Insufficient disk space, dependency conflicts

---

### PostgreSQL Service Management

#### `sudo systemctl is-active postgresql`
- **Purpose**: Checks if PostgreSQL service is running
- **Why**: Verify service status before operations
- **Flags**: None
- **Expected Output**: "active" or "inactive"
- **Failure Scenarios**: Service not installed

#### `sudo systemctl start postgresql`
- **Purpose**: Starts PostgreSQL service
- **Why**: Required for database operations
- **Flags**: None
- **Expected Output**: Service start confirmation
- **Failure Scenarios**: Service already running, configuration errors

#### `sudo systemctl restart postgresql`
- **Purpose**: Restarts PostgreSQL service
- **Why**: Required after configuration changes
- **Flags**: None
- **Expected Output**: Service restart confirmation
- **Failure Scenarios**: Configuration syntax errors

---

### Database and User Management

#### `sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${username}'"`
- **Purpose**: Checks if PostgreSQL user exists
- **Why**: Avoid creating duplicate users
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-t`: Print rows only (no headers)
  - `-A`: Unaligned output mode
  - `-c`: Execute command
- **Expected Output**: "1" if user exists, empty if not
- **Failure Scenarios**: PostgreSQL not running, permission errors

#### `sudo -u postgres psql -c "CREATE USER ${username} WITH PASSWORD '${password}';"`
- **Purpose**: Creates PostgreSQL user with password
- **Why**: Required for database access
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-c`: Execute SQL command
- **Security Risk**: Password in command string (visible in process list)
- **Expected Output**: CREATE ROLE confirmation
- **Failure Scenarios**: User already exists, invalid password format

#### `sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw ${database} && echo "1" || echo "0"`
- **Purpose**: Checks if database exists
- **Why**: Avoid creating duplicate databases
- **Command Breakdown**:
  - `psql -lqt`: List databases, tabular format, tuples only
  - `cut -d \| -f 1`: Extract first column (database name)
  - `grep -qw ${database}`: Quiet word match for database name
  - `&& echo "1" || echo "0"`: Return 1 if found, 0 if not
- **Expected Output**: "1" or "0"
- **Failure Scenarios**: PostgreSQL not running

#### `sudo -u postgres createdb ${database}`
- **Purpose**: Creates PostgreSQL database
- **Why**: Required for storing data
- **Flags**: None
- **Expected Output**: Database creation confirmation
- **Failure Scenarios**: Database already exists, permission errors

#### `sudo -u postgres psql -c "CREATE DATABASE ${database} OWNER ${username};"`
- **Purpose**: Creates database with specific owner
- **Why**: Assigns ownership to created user
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-c`: Execute SQL command
- **Expected Output**: CREATE DATABASE confirmation
- **Failure Scenarios**: Database exists, user doesn't exist

#### `sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${database} TO ${username};"`
- **Purpose**: Grants all privileges on database to user
- **Why**: Allows user to manage database
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-c`: Execute SQL command
- **Expected Output**: GRANT confirmation
- **Failure Scenarios**: Database or user doesn't exist

---

### Database Query Commands

#### `sudo -u postgres psql -d ${database} -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"`
- **Purpose**: Lists all tables in public schema
- **Why**: Get table names for UI display
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-d ${database}`: Connect to specific database
  - `-c`: Execute SQL command
- **Expected Output**: Table names with headers and formatting
- **Failure Scenarios**: Database doesn't exist, permission errors

#### `psql -U ${username} -d ${database} -c "SELECT * FROM \"${tableName}\";" --csv`
- **Purpose**: Retrieves all rows from table as CSV
- **Why**: Easy parsing and data transfer
- **Flags**:
  - `-U ${username}`: Connect as specific user
  - `-d ${database}`: Connect to database
  - `-c`: Execute SQL command
  - `--csv`: Output in CSV format
- **Security**: Table name validated and escaped
- **Expected Output**: CSV data with headers
- **Failure Scenarios**: Table doesn't exist, permission errors, invalid table name

---

### Database Deletion Commands

#### `sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();"`
- **Purpose**: Terminates all connections to database
- **Why**: Required before dropping database (PostgreSQL doesn't allow dropping database with active connections)
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-c`: Execute SQL command
- **SQL Breakdown**:
  - `pg_stat_activity`: System view showing active connections
  - `pg_terminate_backend()`: Function to terminate connection
  - `pid <> pg_backend_pid()`: Excludes current connection
- **Expected Output**: Termination confirmations
- **Failure Scenarios**: No active connections, permission errors

#### `sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${databaseName};"`
- **Purpose**: Drops database
- **Why**: Removes database from system
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-c`: Execute SQL command
- **SQL**: `IF EXISTS` prevents errors if database doesn't exist
- **Expected Output**: DROP DATABASE confirmation
- **Failure Scenarios**: Active connections (should be terminated first), permission errors

---

### PostgreSQL Configuration Commands

#### `ls /etc/postgresql/ | head -n 1`
- **Purpose**: Gets PostgreSQL version directory name
- **Why**: Configuration files are version-specific
- **Command Breakdown**:
  - `ls /etc/postgresql/`: Lists version directories
  - `head -n 1`: Gets first line (version)
- **Expected Output**: Version number (e.g., "14", "15")
- **Failure Scenarios**: PostgreSQL not installed, permission errors

#### `sudo cp /etc/postgresql/${version}/main/postgresql.conf ...bak`
- **Purpose**: Backs up PostgreSQL configuration file
- **Why**: Allows rollback if configuration fails
- **Flags**: None
- **Expected Output**: File copy confirmation
- **Failure Scenarios**: File doesn't exist, permission errors

#### `sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" ...`
- **Purpose**: Enables PostgreSQL to listen on all network interfaces
- **Why**: Required for remote connections
- **Command Breakdown**:
  - `sed -i`: In-place file editing
  - `s/.../.../`: Substitute pattern
  - `#listen_addresses = 'localhost'`: Commented default
  - `listen_addresses = '*'`: Listen on all interfaces
- **Expected Output**: File modification confirmation
- **Failure Scenarios**: Pattern not found, permission errors

#### `echo "host all all 0.0.0.0/0 scram-sha-256" | sudo tee -a ...`
- **Purpose**: Adds remote access rule to pg_hba.conf
- **Why**: Allows remote connections with password authentication
- **Command Breakdown**:
  - `echo`: Outputs rule string
  - `sudo tee -a`: Appends to file with sudo
  - `host all all 0.0.0.0/0 scram-sha-256`: Access rule
    - `host`: TCP/IP connection
    - `all all`: All databases, all users
    - `0.0.0.0/0`: All IP addresses
    - `scram-sha-256`: Authentication method
- **Security Risk**: Opens to all IPs (should be restricted)
- **Expected Output**: Rule appended to file
- **Failure Scenarios**: Permission errors, invalid syntax

---

### File Operations

#### `cat > ${tmpFile} << 'EOSQL' ... EOSQL`
- **Purpose**: Writes SQL content to temporary file
- **Why**: Required for executing SQL files via psql
- **Command Breakdown**:
  - `cat > ${tmpFile}`: Write to file
  - `<< 'EOSQL'`: Heredoc delimiter (single quotes prevent expansion)
  - `...`: SQL content
  - `EOSQL`: End delimiter
- **Expected Output**: File created with SQL content
- **Failure Scenarios**: Disk full, permission errors

#### `sudo -u postgres psql -d ${database} -f ${tmpFile}`
- **Purpose**: Executes SQL file
- **Why**: Allows executing multiple SQL statements
- **Flags**:
  - `-u postgres`: Run as postgres user
  - `-d ${database}`: Connect to database
  - `-f`: Execute file
- **Expected Output**: SQL execution results
- **Failure Scenarios**: SQL syntax errors, file doesn't exist

#### `rm ${tmpFile}`
- **Purpose**: Deletes temporary file
- **Why**: Cleanup after SQL execution
- **Flags**: None
- **Expected Output**: File deletion confirmation
- **Failure Scenarios**: File doesn't exist, permission errors

---

## Security Analysis

### Authentication & Authorization

#### JWT Token Authentication
- **Implementation**: `checkAuth` middleware validates JWT tokens from cookies
- **Token Source**: `cookie.accessToken`
- **Verification**: Uses `verifyAccessToken()` with `ACCESS_TOKEN_SECRET`
- **User Extraction**: Extracts `userId` from token payload
- **Failure Handling**: Returns 419 status code on invalid/missing token

**Security Considerations**:
- ✅ Uses secure JWT verification
- ⚠️ Token stored in cookies (should use httpOnly flag)
- ⚠️ No token refresh mechanism
- ⚠️ No rate limiting on authentication

#### Machine Ownership Verification
- **Implementation**: `verifyMachine()` function
- **Checks**:
  1. Machine ID exists in database
  2. Machine belongs to authenticated user (`ownerId` matches)
  3. Provided IP matches stored IP (`vps_ip`)
- **Database**: External `DEPLOYMENT_MANAGER_DATABASE_URL`
- **Query**: Parameterized to prevent SQL injection

**Security Considerations**:
- ✅ Prevents unauthorized access to other users' machines
- ✅ IP verification prevents IP spoofing
- ✅ Uses parameterized queries

---

### Input Validation

#### Request Body Validation
- **Implementation**: Manual checks in controllers
- **Pattern**: Checks for required fields, returns 400 if missing
- **Examples**:
  - `deployPostgresController`: Validates `vpsId`, `vpsIp`, `dbName`, `userName`, `password`
  - `getTablesListController`: Validates `databaseName`, `vpsId`, `vpsIp`, `username`
  - `getTableData`: Validates all required fields

**Security Considerations**:
- ✅ Basic validation present
- ⚠️ No type validation (relies on TypeScript types)
- ⚠️ No length limits on inputs
- ⚠️ No special character validation (except table names)

#### Table Name Validation
- **Implementation**: Regex validation in `getTableData()`
- **Pattern**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- **Rules**:
  - Must start with letter or underscore
  - Can contain letters, numbers, underscores
  - Prevents SQL injection through table names

**Security Considerations**:
- ✅ Prevents SQL injection via table names
- ✅ Escapes table name in double quotes
- ✅ Validates before database query

---

### SQL Injection Prevention

#### Parameterized Queries
- **Drizzle ORM**: Uses parameterized queries for metadata database
- **Example**: `db.select().from(deployed_db).where(eq(deployed_db.userId, userId))`
- **External Database**: Uses `pool.query()` with parameterized queries
- **Example**: `pool.query('SELECT * FROM vps_machines WHERE id=$1', [machineId])`

**Security Considerations**:
- ✅ Metadata queries use parameterized queries
- ⚠️ Shell commands use string interpolation (potential risk)
- ⚠️ PostgreSQL commands executed via shell (not parameterized)

#### Shell Command Escaping
- **Implementation**: Escapes double quotes in SQL strings
- **Example**: `sql.replace(/"/g, '\\"')` in `executeSQL()`
- **Limitation**: Only escapes quotes, doesn't prevent all injection

**Security Considerations**:
- ⚠️ Limited escaping (only quotes)
- ⚠️ User input in shell commands (database names, usernames)
- ✅ Table names validated before use
- ⚠️ Database names and usernames not validated

**Recommendations**:
- Validate database names and usernames with regex
- Use PostgreSQL's `quote_ident()` function
- Consider using connection libraries instead of shell commands

---

### Credential Handling

#### Password Encryption
- **Storage**: VPS passwords encrypted with AES
- **Implementation**: `decryptVpsPassword()` uses CryptoJS.AES.decrypt
- **Key**: `ENCRYPTION_KEY` from environment variables
- **Decryption**: Happens before SSH connection

**Security Considerations**:
- ✅ Passwords encrypted at rest
- ✅ Encryption key in environment variable
- ⚠️ Decrypted passwords in memory (unavoidable)
- ⚠️ No key rotation mechanism

#### PostgreSQL Password Handling
- **Storage**: PostgreSQL passwords stored in plaintext in metadata database
- **Transmission**: Passwords sent in request body (should use HTTPS)
- **Command Execution**: Passwords visible in shell command strings

**Security Considerations**:
- ⚠️ Passwords stored in plaintext
- ⚠️ Passwords visible in process list when creating users
- ⚠️ Should use environment variables or password files
- ✅ HTTPS should be used for transmission

**Recommendations**:
- Encrypt PostgreSQL passwords in metadata database
- Use `psql` with password file (`~/.pgpass`)
- Use environment variables for password passing

---

### Network Security

#### CORS Configuration
- **Allowed Origins**:
  - `http://localhost:5173` (development)
  - `https://zyotraportal.ramkrishna.cloud` (production)
- **Allowed Methods**: GET, POST, PUT, DELETE
- **Allowed Headers**: Content-Type, Authorization

**Security Considerations**:
- ✅ CORS restricted to specific origins
- ✅ Methods limited to necessary ones
- ⚠️ Should validate Origin header server-side

#### PostgreSQL Remote Access
- **Configuration**: Opens PostgreSQL to all IPs (`0.0.0.0/0`)
- **Authentication**: Uses `scram-sha-256` (secure)
- **Risk**: High - any IP can attempt connection

**Security Considerations**:
- ⚠️ **CRITICAL**: Opens database to entire internet
- ✅ Uses secure authentication method
- ⚠️ Should restrict to specific IP ranges
- ⚠️ Should use firewall rules

**Recommendations**:
- Restrict `pg_hba.conf` to specific IP ranges
- Use firewall (iptables/ufw) to limit access
- Consider VPN or SSH tunneling for access

---

### Error Handling

#### Error Information Disclosure
- **Implementation**: Returns error messages to client
- **Examples**: Database errors, SSH errors, validation errors
- **Risk**: May expose internal system information

**Security Considerations**:
- ⚠️ Error messages may expose system details
- ⚠️ Stack traces not filtered
- ✅ HTTP status codes used appropriately

**Recommendations**:
- Sanitize error messages before returning
- Log detailed errors server-side
- Return generic messages to clients

---

### Rate Limiting

**Current Status**: ❌ No rate limiting implemented

**Security Considerations**:
- ⚠️ Vulnerable to brute force attacks
- ⚠️ No protection against DDoS
- ⚠️ No request throttling

**Recommendations**:
- Implement rate limiting middleware
- Limit authentication attempts
- Limit database operations per user

---

## Data Flow Diagrams

### 1. Database Deployment Flow

```
Client Request (POST /deploy-postgres)
    ↓
[checkAuth Middleware]
    ├─ Extract JWT token from cookie
    ├─ Verify token with ACCESS_TOKEN_SECRET
    └─ Extract userId → Pass to controller
    ↓
[deployPostgresController]
    ├─ Validate request body
    ├─ Call verifyMachine(vpsId, userId, vpsIp)
    │   └─ Query DEPLOYMENT_MANAGER_DB → vps_machines table
    │       ├─ Check ownership (ownerId = userId)
    │       └─ Verify IP match
    ├─ Check existing database in STORAGE_LAYER_DB
    ├─ Call decryptPassword(machine.vps_password)
    │   └─ CryptoJS.AES.decrypt → Plaintext password
    ├─ Create SSHClient → Connect to VPS
    ├─ Create PostgresSSHHelper(ssh)
    ├─ pgHelper.install()
    │   └─ SSH: sudo apt update && sudo apt install postgresql
    ├─ pgHelper.start()
    │   └─ SSH: sudo systemctl start postgresql
    ├─ pgHelper.createUserAndDatabase()
    │   ├─ SSH: Check user exists
    │   ├─ SSH: CREATE USER (if needed)
    │   ├─ SSH: Check database exists
    │   ├─ SSH: CREATE DATABASE (if needed)
    │   └─ SSH: GRANT PRIVILEGES
    ├─ pgHelper.allowRemoteConnections()
    │   ├─ SSH: Backup configs
    │   ├─ SSH: Update postgresql.conf
    │   ├─ SSH: Update pg_hba.conf
    │   └─ SSH: Restart PostgreSQL
    ├─ Insert metadata into STORAGE_LAYER_DB
    │   └─ deployed_db table
    └─ Return success response
```

### 2. Get Tables List Flow

```
Client Request (POST /get-tables-list)
    ↓
[checkAuth Middleware]
    └─ Verify JWT → Extract userId
    ↓
[getTablesListController]
    ├─ Validate request body
    ├─ Call verifyMachine(vpsId, userId, vpsIp)
    │   └─ Query DEPLOYMENT_MANAGER_DB
    ├─ Call decryptVpsPassword(machine.vps_password)
    ├─ Create SSHClient → Connect to VPS
    ├─ Create PostgresSSHHelper(ssh)
    ├─ pgHelper.getTablesList(databaseName)
    │   └─ SSH: psql -c "SELECT table_name FROM information_schema.tables..."
    ├─ Call parseTableNames(tables)
    │   └─ Filter headers, separators, footers
    └─ Return table names array
```

### 3. Get Table Data Flow

```
Client Request (POST /get-table-data)
    ↓
[checkAuth Middleware]
    └─ Verify JWT → Extract userId
    ↓
[getTableData Controller]
    ├─ Validate request body
    ├─ Call verifyMachine(vpsId, userId, vpsIp)
    ├─ Call decryptVpsPassword(machine.vps_password)
    ├─ Create SSHClient → Connect to VPS
    ├─ Create PostgresSSHHelper(ssh)
    ├─ pgHelper.getTableData(databaseName, tableName, username)
    │   ├─ Validate table name (regex)
    │   ├─ SSH: psql -U username -d database -c "SELECT * FROM table" --csv
    │   ├─ Check exit code
    │   ├─ Parse CSV with PapaParse
    │   └─ Return parsed JSON array
    └─ Return data to client
```

### 4. Delete Database Flow

```
Client Request (DELETE /delete-db/:id)
    ↓
[checkAuth Middleware]
    └─ Verify JWT → Extract userId
    ↓
[deleteDatabaseController]
    ├─ Extract database ID from params
    ├─ Query STORAGE_LAYER_DB → deployed_db table (by ID)
    ├─ Call verifyMachine(vpsId, userId, vpsIp)
    ├─ Call decryptPassword(machine.vps_password)
    ├─ Create SSHClient → Connect to VPS
    ├─ Create PostgresSSHHelper(ssh)
    ├─ pgHelper.dropDatabase(databaseName)
    │   ├─ SSH: Terminate all connections
    │   └─ SSH: DROP DATABASE
    ├─ Delete from STORAGE_LAYER_DB → deployed_db table
    └─ Return success response
```

---

## Database Schema

### Storage Layer Database (STORAGE_LAYER_DATABASE_URL)

#### Table: `deployed_db`

**Purpose**: Stores metadata about deployed databases

**Schema**:
```sql
CREATE TABLE deployed_db (
    id SERIAL PRIMARY KEY,
    db_name VARCHAR NOT NULL,
    username VARCHAR NOT NULL,
    password VARCHAR NOT NULL,
    host VARCHAR NOT NULL,
    db_type VARCHAR NOT NULL,
    vps_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

**Columns**:
- `id`: Primary key, auto-increment
- `db_name`: Database name
- `username`: PostgreSQL username
- `password`: PostgreSQL password (stored in plaintext)
- `host`: VPS IP address
- `db_type`: Database type (e.g., "postgres")
- `vps_id`: Foreign key to VPS machine
- `user_id`: Foreign key to user who deployed
- `status`: Deployment status (e.g., "running")
- `created_at`: Timestamp of creation

**Indexes**: None defined (should add indexes on `user_id`, `vps_id`, `host`)

**Relationships**:
- `user_id` → References user in external system
- `vps_id` → References VPS in `DEPLOYMENT_MANAGER_DATABASE_URL`

---

### Deployment Manager Database (DEPLOYMENT_MANAGER_DATABASE_URL)

#### Table: `vps_machines`

**Purpose**: Registry of VPS machines and their owners

**Schema** (inferred from queries):
```sql
CREATE TABLE vps_machines (
    id INTEGER PRIMARY KEY,
    "ownerId" INTEGER NOT NULL,
    vps_ip VARCHAR NOT NULL,
    vps_password VARCHAR NOT NULL,  -- Encrypted
    -- Other columns not visible in codebase
);
```

**Columns** (from code usage):
- `id`: Primary key
- `ownerId`: User ID who owns the machine
- `vps_ip`: IP address of VPS
- `vps_password`: Encrypted password for SSH access

**Queries Used**:
- `SELECT * FROM vps_machines WHERE id=$1 AND "ownerId"=$2`

---

## Environment Variables

### Required Variables

1. **PORT**
   - **Purpose**: Server port number
   - **Example**: `"3000"`
   - **Used In**: `src/index.ts`

2. **STORAGE_LAYER_DATABASE_URL**
   - **Purpose**: PostgreSQL connection string for metadata database
   - **Format**: `postgresql://user:password@host:port/database`
   - **Used In**: `src/db/client.ts`, `drizzle.config.ts`

3. **DEPLOYMENT_MANAGER_DATABASE_URL**
   - **Purpose**: PostgreSQL connection string for VPS registry
   - **Format**: `postgresql://user:password@host:port/database`
   - **Used In**: `src/db/pool.ts`

4. **ACCESS_TOKEN_SECRET**
   - **Purpose**: JWT secret for token verification
   - **Example**: `"your-secret-key-here"`
   - **Used In**: `src/jwt/verifyTokens.ts`

5. **ENCRYPTION_KEY**
   - **Purpose**: AES encryption key for VPS passwords
   - **Example**: `"your-encryption-key-here"`
   - **Used In**: `src/utils/decryptPassword.ts`

---

## Known Issues & Bugs

### 1. `createDatabase()` Logic Bug
**Location**: `src/HelperClasses/PostgresHelper.ts:33-41`

**Issue**: Logic is inverted - throws error when database doesn't exist, should create it.

**Current Code**:
```typescript
if (dbExists.output.trim() === "0") {
    await this.ssh.exec(`sudo -u postgres createdb ${database}`, onLog);
}
throw new Error("Database already exists");
```

**Fix**: Should only throw if database exists (output === "1").

---

### 2. Unused Body Parameter
**Location**: `src/controllers/deleteDatabaseController.ts:12`

**Issue**: Function declares body parameter but doesn't use it. Database details come from database query instead.

**Current Code**:
```typescript
const req=body as {dbName:string,vpsIp:string,vpsId:string}
// req is never used
```

**Fix**: Remove unused body parameter or use it for validation.

---

### 3. Password Security in Shell Commands
**Location**: Multiple locations in `PostgresHelper.ts`

**Issue**: PostgreSQL passwords passed in shell command strings, visible in process list.

**Recommendation**: Use environment variables or password files.

---

### 4. PostgreSQL Remote Access Security
**Location**: `PostgresHelper.ts:allowRemoteConnections()`

**Issue**: Opens PostgreSQL to all IPs (`0.0.0.0/0`), major security risk.

**Recommendation**: Restrict to specific IP ranges or use firewall rules.

---

### 5. Missing Input Validation
**Location**: Multiple controllers

**Issue**: Database names and usernames not validated (only table names are).

**Recommendation**: Add regex validation similar to table names.

---

### 6. Error Message Exposure
**Location**: All controllers

**Issue**: Error messages may expose internal system details.

**Recommendation**: Sanitize error messages before returning to client.

---

## Recommendations

### Security Improvements

1. **Implement Rate Limiting**: Prevent brute force and DDoS attacks
2. **Restrict PostgreSQL Access**: Use firewall rules and IP whitelisting
3. **Encrypt PostgreSQL Passwords**: Store passwords encrypted in metadata database
4. **Validate All Inputs**: Add regex validation for database names and usernames
5. **Sanitize Error Messages**: Don't expose internal details to clients
6. **Use Password Files**: Avoid passwords in command strings
7. **Add HTTPS**: Ensure all communication is encrypted
8. **Implement Token Refresh**: Add refresh token mechanism

### Code Quality Improvements

1. **Fix `createDatabase()` Bug**: Invert logic
2. **Remove Unused Parameters**: Clean up `deleteDatabaseController`
3. **Add Database Indexes**: Improve query performance
4. **Add Logging**: Implement structured logging
5. **Add Tests**: Unit and integration tests
6. **Add Type Safety**: Stricter TypeScript types
7. **Error Handling**: More specific error types

### Performance Improvements

1. **Connection Pooling**: Already using pools, ensure proper configuration
2. **Caching**: Cache machine verification results
3. **Async Operations**: Optimize sequential SSH commands where possible
4. **Database Indexes**: Add indexes on frequently queried columns

---

## Conclusion

This documentation provides a comprehensive overview of the StorageLayer codebase, including all API routes, functions, commands, security considerations, and data flows. Use this as a reference for understanding, maintaining, and extending the system.
