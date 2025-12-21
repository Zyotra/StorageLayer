import { Context } from "elysia"
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";
import MySQLHelper from "../../HelperClasses/mySQLHelper";
import decryptVpsPassword from "../../utils/decryptPassword";
import { db } from "../../db/client";
import { deployed_db } from "../../db/schema";
import { and, eq } from "drizzle-orm";
import verifyMachine from "../../utils/verifyMachine";
const deleteMySQL=async({body,set,userId}:Context | any)=>{
    const req = body as { vpsId: string,vpsIp:string, dbName: string,userName:string, password: string,rootPassword:string };
    const {vpsId,vpsIp,dbName,userName,password,rootPassword} = req;
    if(!userName || !password || !dbName || !vpsIp || !vpsId){
        set.status = StatusCode.BAD_REQUEST;
        return {
            message: "Invalid request body"
        }
    }
    const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp);
    if(!isMachineVerified.status){
        set.status = StatusCode.FORBIDDEN;
        return {
            message: "Unauthorized access for the machine"
        }
    }
    var ssh:SSHClient | null =null
    var sqlHelper:MySQLHelper | null =null
    const {machine}=isMachineVerified;
    try {
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh=new SSHClient({
            username:"root",
            host:vpsIp,
            password:hashedPassword
        })
        await ssh.connect()
        sqlHelper=new MySQLHelper(ssh)
        await sqlHelper.dropDatabase(userName,password,dbName)
        await db.delete(deployed_db).where(and(
            eq(deployed_db.dbName,dbName),
            eq(deployed_db.dbType,"mysql"),
            eq(deployed_db.host,vpsIp)
        ))
        set.status=StatusCode.OK
        return {
            status:"success",
            message:"Database deleted succesfully"
        }
    }catch(error){
        console.log("Error while deleting",error)
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            status:"Internal Server Error",
            message:error
        }
    }finally{
        if(ssh){
            await ssh.close()
        }
    }
}
export default deleteMySQL