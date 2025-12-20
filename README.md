# StorageLayer - PostgreSQL Database Management API

## Overview

StorageLayer is a Node.js/Bun-based microservice that provides RESTful API endpoints for managing PostgreSQL database deployments on remote VPS machines via SSH. It handles database creation, deletion, table listing, and data retrieval operations securely through authenticated SSH connections.

## Architecture

- **Framework**: Elysia.js (Bun runtime)
- **Database ORM**: Drizzle ORM
- **Authentication**: JWT-based token authentication
- **SSH Client**: ssh2 library for remote command execution
- **Database**: PostgreSQL (both for metadata storage and managed databases)

## Key Features

1. **PostgreSQL Deployment**: Automatically installs and configures PostgreSQL on remote VPS machines
2. **Database Management**: Create, delete, and list databases
3. **Table Operations**: List tables and retrieve table data from remote databases
4. **Security**: JWT authentication, machine ownership verification, encrypted password storage
5. **Remote Access Configuration**: Automatically configures PostgreSQL for remote connections

## API Endpoints

### Public Endpoints

- `GET /` - Health check endpoint

### Protected Endpoints (Require Authentication)

- `POST /deploy-postgres` - Deploy PostgreSQL database on a VPS
- `DELETE /delete-db/:id` - Delete a deployed database
- `GET /get-db` - Get list of all databases for authenticated user
- `POST /get-tables-list` - Get list of tables in a database
- `POST /get-table-data` - Get data from a specific table

## Technology Stack

- **Runtime**: Bun
- **Web Framework**: Elysia.js
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **SSH**: ssh2
- **CSV Parsing**: PapaParse
- **Encryption**: CryptoJS (AES)
- **JWT**: jsonwebtoken

## Environment Variables

- `PORT` - Server port number
- `STORAGE_LAYER_DATABASE_URL` - Connection string for metadata database
- `DEPLOYMENT_MANAGER_DATABASE_URL` - Connection string for VPS machine registry
- `ACCESS_TOKEN_SECRET` - JWT secret for token verification
- `ENCRYPTION_KEY` - AES encryption key for VPS passwords

## Getting Started

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

### Database Setup

Run migrations using Drizzle Kit:

```bash
bunx drizzle-kit push
```

## Project Structure

```
src/
├── controllers/          # API route handlers
├── db/                   # Database configuration and schema
├── HelperClasses/        # Business logic helpers (PostgresSSHHelper)
├── middlewares/          # Authentication middleware
├── SSHClient/            # SSH connection wrapper
├── jwt/                  # JWT verification utilities
├── utils/                # Utility functions
└── types/                # TypeScript type definitions
```

## Security Features

- JWT token-based authentication
- Machine ownership verification before operations
- Encrypted password storage (AES)
- SQL injection prevention through parameterized queries
- Table name validation (alphanumeric + underscore only)
- CORS protection with whitelisted origins

## Data Flow

1. **Request** → Authentication middleware validates JWT token
2. **Controller** → Validates request body and verifies machine ownership
3. **Service** → Establishes SSH connection and executes PostgreSQL commands
4. **Database** → Updates metadata in local database
5. **Response** → Returns success/error response to client

## External Dependencies

- **VPS Machines**: Requires SSH access to remote machines
- **Deployment Manager Database**: External database containing VPS machine registry
- **Storage Layer Database**: Local database for tracking deployed databases

## CORS Configuration

Allowed origins:
- `http://localhost:5173` (development)
- `https://zyotraportal.ramkrishna.cloud` (production)

## License

[Add your license here]
