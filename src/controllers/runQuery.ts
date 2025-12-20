import { Context } from "elysia";
import SSHClient from "../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../HelperClasses/PostgresHelper";
import verifyMachine from "../utils/verifyMachine";
import { StatusCode } from "../types/types";
import decryptVpsPassword from "../utils/decryptPassword";
const runQuery = async ({ set, body,userId }: Context|any) => {
  const req = body as {
    databaseName: string;
    vpsId: string;
    vpsIp: string;
    username: string;
    query:string
  };
  const { databaseName, vpsId, vpsIp, username,query } = req;
  var ssh: SSHClient | null = null;
  var pgHelper: PostgresSSHHelper | null = null;
  if (!databaseName || !vpsId || !vpsIp || !username || !query) {
    set.status = StatusCode.BAD_REQUEST;
    return {
      message: "Invalid request body",
    };
  }
  const isMachineVerified = await verifyMachine(
    vpsId.toString(),
    userId,
    vpsIp
  );
  if (!isMachineVerified.status) {
    set.status = StatusCode.FORBIDDEN;
    return {
      message: "Unauthorized access for the machine",
    };
  }
  const { machine } = isMachineVerified;
  const hashedPassword = await decryptVpsPassword(machine.vps_password);
  console.log("password hashed creating ssh");
  console.log(machine);
  try {
    ssh = new SSHClient({
      host: machine.vps_ip,
      username: "root",
      password: hashedPassword,
    });
    await ssh.connect();
    console.log("connected to ssh");
    pgHelper = new PostgresSSHHelper(ssh);
    const result=await pgHelper.executeSql(query,username,databaseName)
    set.status=StatusCode.OK
    return{
        message:"success",
        rows:result
    }
  } catch (error) {
    console.log("Error while running query")
    set.status=StatusCode.INTERNAL_SERVER_ERROR
    return{
        message:error
    }
  } finally {
    if(ssh){
        await ssh.close()
    }
  }
};
export default runQuery;
