import { Context } from "elysia";
import verifyMachine from "../../utils/verifyMachine";
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";
import decryptVpsPassword from "../../utils/decryptPassword";
import RedisHelper from "../../HelperClasses/RedisHelper";
import { caching } from "../../db/schema";
import { db } from "../../db/client";
import { and, eq } from "drizzle-orm";
const stopRedisServer = async ({ body, set, userId }: Context | any) => {
  const req = body as {
    name: string;
    password: string;
    vpsId: string;
    vpsIp: string;
    port: string;
  };
  const { name, password, vpsId, vpsIp, port } = req;
  if (!name || !password || !vpsId || !port || !vpsIp) {
    set.status = StatusCode.BAD_REQUEST;
    return {
      message: "Invalid request body",
    };
  }
  const isMachineVerified = await verifyMachine(vpsId, userId, vpsIp);
  if (!isMachineVerified.status) {
    set.status = StatusCode.BAD_REQUEST;
    return {
      message: "unauthorized machine access",
    };
  }
  var ssh: SSHClient | null = null;
  var redis: RedisHelper | null = null;
  const { machine } = isMachineVerified;
  try {
    const hashedPassword = await decryptVpsPassword(password);
    ssh = new SSHClient({
      host: machine.vps_ip,
      password: password,
      username: "root",
    });
    await ssh.connect();
    redis = new RedisHelper(ssh);
    const result = await redis.stopRedisSever(password, port);
    await db
      .update(caching)
      .set({ status: "stopped" })
      .where(and(eq(caching.host, vpsIp),eq(caching.port,parseInt(port))));
    set.status = StatusCode.OK;
    return {
      message: "Stopped redis server",
    };
  } catch (error) {
    set.status = StatusCode.INTERNAL_SERVER_ERROR;
    return {
      message: error,
    };
  } finally {
    if (ssh) {
      ssh.close();
    }
  }
};
export default stopRedisServer;
