import { Context } from "elysia";
import { StatusCode } from "../types/types";
import { deployed_db } from "../db/schema";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import verifyMachine from "../utils/verifyMachine";
import decryptVpsPassword from "../utils/decryptPassword";
import SSHClient from "../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../HelperClasses/PostgresHelper";
import parseTableNames from "../utils/parseTableNames";
const getTablesListController=async({body,set,userId}:Context | any)=>{
    const req=body as {databaseName:string,vpsId:string,vpsIp:string};
    const {databaseName,vpsId,vpsIp}=req;
    var ssh:SSHClient | null =null;
    var pgHelper:PostgresSSHHelper | null =null;
    if(!databaseName || !vpsId || !vpsIp){
        set.status=StatusCode.BAD_REQUEST;
        return {
            message:"Invalid request body"
        }
    }
    const isMachineVerified=await verifyMachine(vpsId.toString(),userId,vpsIp);
    if(!isMachineVerified.status){
        set.status=StatusCode.FORBIDDEN;
        return {
            message:"Unauthorized access for the machine"
        }
    }
    const {machine}=isMachineVerified;
    const hashedPassword = await decryptVpsPassword(machine.vps_password);
    console.log("password hashed creating ssh")
    console.log(machine)
    try {
        ssh = new SSHClient({
            host: machine.vps_ip,
            username: "root",
            password: hashedPassword
        })
        await ssh.connect();
        console.log("connected to ssh")
        pgHelper = new PostgresSSHHelper(ssh);
        const tables=await pgHelper.getTablesList(databaseName);
        const tableNames=parseTableNames(tables);
        console.log(tableNames)
        await ssh.close();
        set.status=StatusCode.OK
        return {
            status:StatusCode.OK,
            data:tableNames,
            message:"Tables list fetched successfully"
        }
    }catch (error) {
        set.status=StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status:"invalid request",
            message: error
        }
    }finally{
        if(ssh){
            ssh.close();
        }
    }
}
export default getTablesListController;