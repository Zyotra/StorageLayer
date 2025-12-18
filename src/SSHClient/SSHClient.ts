import {Client, ConnectConfig} from "ssh2";
interface CommandResult {
    command: string;
    output: string;
    exitCode: number;
}

class SSHClient {
    private conn: Client;
    private config: ConnectConfig;
    constructor(config: ConnectConfig) {
        this.conn = new Client();
        this.config = config;
    }
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.conn.on('ready', resolve);
            this.conn.on('error', reject);
            this.conn.connect(this.config);
        });
    }

    exec(command: string, onLog?: (chunk: string) => void): Promise<CommandResult> {
        return new Promise((resolve, reject) => {
            this.conn.exec(command, (err, stream) => {
                if (err) return reject(err);

                let output = '';
                let stderr = '';

                // 2. Listen to the stream events
                stream.on('data', async (data: Buffer) => {
                    await new Promise(res=>process.nextTick(res));
                    await Bun.sleep(1)
                    const chunk = data.toString();
                    console.log(chunk)
                    output += chunk;
                    // 3. If a callback exists, send data immediately
                    if (onLog) onLog(chunk);
                });

                stream.stderr.on('data', async(data: Buffer) => {
                    await new Promise(res=>process.nextTick(res));
                    await Bun.sleep(1)
                    const chunk = data.toString();
                    console.log(chunk)
                    stderr += chunk;
                    // Stream errors too (maybe prefix with [ERR])
                    if (onLog) onLog(chunk);
                });

                stream.on('close', async(exitCode: number) => {
                    await new Promise(res=>process.nextTick(res));
                    await Bun.sleep(1)
                    resolve({command, output, exitCode});
                });
            });
        });
    }

    // 4. Update sequential runner to pass the callback down
    async runSequential(commands: string[], onLog?: (chunk: string) => void): Promise<CommandResult[]> {
        const results: CommandResult[] = [];
        for (const cmd of commands) {
            const result = await this.exec(cmd, onLog);
            results.push(result);
            if(result.exitCode !== 0){
                if (onLog) onLog(`Command "${cmd}" failed with exit code ${result.exitCode}. Stopping execution.\n`);
                throw new Error(`Command "${cmd}" failed with exit code ${result.exitCode}`);
            }
        }
        return results;
    }

    close(): void {
        this.conn.end();
    }
}

export default SSHClient;