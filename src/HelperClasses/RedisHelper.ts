import SSHClient from "../SSHClient/SSHClient";
import fs from "fs";
import getRedisConfig from "../utils/getRedisConfig";
interface CommandResult {
  command: string;
  output: string;
  exitCode: number;
}

interface RedisInfo {
  version: string;
  uptime: string;
  connectedClients: number;
  usedMemory: string;
  totalKeys: number;
}

interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number; // -1 = no expiry, -2 = key doesn't exist
  size?: number;
}

class RedisHelper {
  private ssh: SSHClient;

  constructor(ssh: SSHClient) {
    this.ssh = ssh;
  }

  async installRedisCLI(onLog?: (chunk: string) => {}) {
    console.log("Installing redis cli");
    this.ssh.exec(`sudo apt install redis-server -y`, onLog);
  }
  async deleteRedisServer(redisName: string, password: string, port: string, onLog?: (chunk: string) => {}) {
    const commands = [
      // Shutdown redis (ignore errors if not running)
      `redis-cli -p ${port} -a ${password} shutdown || true`,
      // Kill any remaining redis process on this port
      `sudo kill $(sudo lsof -t -i:${port}) 2>/dev/null || true`,
      // Disable systemd service if it exists (ignore errors)
      `sudo systemctl disable ${redisName} 2>/dev/null || true`,
      `sudo systemctl stop ${redisName} 2>/dev/null || true`,
      // Remove service file if it exists
      `sudo rm -f /etc/systemd/system/${redisName}.service`,
      // Reload systemd
      `sudo systemctl daemon-reexec`,
      `sudo systemctl daemon-reload`,
      // Remove config and data files
      `sudo rm -f /etc/redis/${redisName}.conf`,
      `sudo rm -f /var/log/redis/${redisName}.log`,
      `sudo rm -rf /var/lib/${redisName}`
    ];
    await this.ssh.runSequential(commands, onLog);
  }
  async startNewRedisServer(
    name: string,
    password: string,
    port: string,
    onLog?: (chunk: string) => void
  ) {
    const configPath = `/etc/redis/${name}.conf`;
    const dataDir = `/var/lib/${name}`;
    const pidDir = `/var/run/redis`;

    const config = getRedisConfig(port, name, password);
    const configB64 = Buffer.from(config).toString("base64");

    const tmpPath = `/tmp/${name}.conf`;

    const commands = [
      // create dirs (try without sudo, fallback to sudo)
      `mkdir -p ${dataDir} || sudo mkdir -p ${dataDir}`,
      `mkdir -p ${pidDir} || sudo mkdir -p ${pidDir}`,
      // write decoded config to /tmp (avoid sudo/tee interactive problems)
      `echo '${configB64}' | base64 -d > ${tmpPath}`,
      // move into place (try move, fallback to sudo move)
      `mv ${tmpPath} ${configPath} || sudo mv ${tmpPath} ${configPath}`,
      // set ownership/permissions (try without sudo, fallback to sudo)
      `chown -R redis:redis ${dataDir} || sudo chown -R redis:redis ${dataDir} || true`,
      `chmod 750 ${dataDir} || sudo chmod 750 ${dataDir} || true`,
      // start redis (try without sudo, fallback to sudo)
      `redis-server ${configPath} --daemonize yes || sudo redis-server ${configPath} --daemonize yes`
    ];
    await this.ssh.runSequential(commands, onLog);

    // verify start
    const check = await this.ssh.exec(`redis-cli -p ${port} -a ${password} ping`);
    if (check.exitCode !== 0 || !/PONG/.test(check.output || "")) {
      throw new Error(`Failed to start redis: ${check.output}`);
    }
  }
  async stopRedisSever(password: string, port: string) {
    await this.ssh.exec(`redis-cli -p ${port} -a ${password} shutdown`)
  }

  async startExistingRedisServer(name: string, password: string, port: string) {
    const configPath = `/etc/redis/${name}.conf`;
    
    // Start redis server using existing config
    const result = await this.ssh.exec(
      `redis-server ${configPath} --daemonize yes || sudo redis-server ${configPath} --daemonize yes`
    );
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start redis server: ${result.output}`);
    }

    // Verify start
    const check = await this.ssh.exec(`redis-cli -p ${port} -a ${password} ping`);
    if (check.exitCode !== 0 || !/PONG/.test(check.output || "")) {
      throw new Error(`Failed to verify redis start: ${check.output}`);
    }
  }
}
export default RedisHelper;
