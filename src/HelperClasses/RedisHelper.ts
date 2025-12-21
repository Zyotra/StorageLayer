import SSHClient from "../SSHClient/SSHClient";
import fs from "fs";
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
  async startNewRedisServer(
    name: string,
    password: string,
    port: string,
    onLog?: (chunk: string) => void
  ) {
    const configPath = `/etc/redis/${name}.conf`;
    const dataDir = `/var/lib/${name}`;
    const pidDir = `/var/run/redis`;

    // 1. Create directories
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(pidDir, { recursive: true });

    // 2. Write config file
    fs.writeFileSync(configPath, getRedisConfig(port, name, password));

    // 3. Start Redis server
    const startCmd = `sudo redis-server ${configPath}`;
    const result = await this.ssh.exec(startCmd, onLog);
    if (result.exitCode !== 0) {
      throw new Error(`Database query failed: ${result.output}`);
    }
  }
  async deleteRedisServer(redisName: string,password:string,port:string,onLog?:(chunk:string)=>{}) {
    const commands = [
      `redis-cli -p ${port} -a ${password} shutdown`,
      `sudo systemctl disable ${redisName}`,
      `sudo rm /etc/systemd/system/${redisName}.service`,
      `sudo systemctl daemon-reexec`,
      `sudo systemctl daemon-reload`,
      `sudo rm /etc/redis/${redisName}.conf`,
      `sudo rm -f /var/log/redis/${redisName}.log`,
      `sudo rm -rf /var/lib/${redisName}`
    ];
    await this.ssh.runSequential(commands,onLog)
  }
  async stopRedisSever(password:string,port:string){
    await this.ssh.exec(`redis-cli -p ${port} -a ${password} shutdown`)
  }
}
export default RedisHelper;
