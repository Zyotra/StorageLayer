import { Context } from "elysia";
import MySQLHelper from "../../HelperClasses/mySQLHelper";
import SSHClient from "../../SSHClient/SSHClient";
import verifyMachine from "../../utils/verifyMachine";
import decryptVpsPassword from "../../utils/decryptPassword";
import { StatusCode } from "../../types/types";

interface ct extends Context{
    userId:string
}
const backupMySQL=async({body,set,userId}:Context | any)=>{
    const req=body as {username:string,password:string,databaseName:string,vpsId:string,vpsIp:string};
    const {username,password,databaseName,vpsId,vpsIp}=req;
    var sqlHelper:MySQLHelper | null=null;
    var ssh:SSHClient|null=null
    try {
        const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp)
        const {machine}=isMachineVerified;
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh=new SSHClient({
            username:"root",
            host:vpsIp,
            password:hashedPassword
        })
        sqlHelper=new MySQLHelper(ssh);
        await sqlHelper.backupDatabase(databaseName,username,password)
        set.status=StatusCode.OK
        return{
            message:"Database backup successful"
        }
    } catch (error) {
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            message:error
        }
    }finally{
        if(ssh){
            await ssh.close()
        }
    }
}
export default backupMySQL