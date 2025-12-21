function getRedisConfig(port: string, name: string, password: string): string {
    return `
# Unique port
port ${port}

# Run as daemon
daemonize yes

# Unique PID file
pidfile /var/run/redis/${name}.pid

# Unique log file
logfile /var/log/redis/${name}.log

# Unique data directory
dir /var/lib/${name}

# Password
requirepass ${password}

# Bind address
bind 0.0.0.0
`.trim(); // removes leading/trailing newlines
}
