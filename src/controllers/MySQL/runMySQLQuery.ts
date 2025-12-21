import { Context } from "elysia";
import SSHClient from "../../SSHClient/SSHClient";
import MySQLHelper from "../../HelperClasses/mySQLHelper";
import { StatusCode } from "../../types/types";
import verifyMachine from "../../utils/verifyMachine";
import decryptVpsPassword from "../../utils/decryptPassword";
import runQuery from "../runQuery";

const runMySQLQuery=async({body,set,userId}:Context | any)=>{
    const req = body as {
        databaseName: string;
        vpsId: string;
        vpsIp: string;
        username: string;
        query:string;
        password:string;
      };
      const { databaseName, vpsId, vpsIp, username,query,password } = req;
      var ssh: SSHClient | null = null;
      var mySQLHelper: MySQLHelper | null = null;
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
        mySQLHelper = new MySQLHelper(ssh);
        const result=await mySQLHelper.executeQuery(databaseName,query,username,password)
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
}
export default runQuery;