import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";
import { PostgresSSHHelper } from "../../HelperClasses/PostgresHelper";
import verifyMachine from "../../utils/verifyMachine";
import decryptVpsPassword from "../../utils/decryptPassword";
import MySQLHelper from "../../HelperClasses/mySQLHelper";
import { password } from "bun";

const getMySQLTableData=async({body,set,userId}:Context | any)=>{
    const req=body as {databaseName:string,vpsId:string,vpsIp:string,tableName:string,username:string,password:string};
    const {databaseName,vpsId,vpsIp,tableName,username,password}=req;
    if(!databaseName || !vpsId || !vpsIp || !tableName || !username || !password){
        set.status=StatusCode.BAD_REQUEST
        return{
            message:"Invalid request body."
        }
    }
    var ssh:SSHClient | null =null;
    var mySQLHelper:MySQLHelper | null =null;
    try {
        const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp)
        if(!isMachineVerified.status){
            set.status=StatusCode.NOT_FOUND
            return{
                message:"Invalid Machine details or you are unauthorized to access this machine"
            }
        }
        const machine=isMachineVerified.machine as any;
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh = new SSHClient({
            host: machine.vps_ip,
            username: "root",
            password: hashedPassword
        })
        await ssh.connect();
        console.log("connected to ssh")
        mySQLHelper= new MySQLHelper(ssh);
        const tableData=await mySQLHelper.getTableData(databaseName,tableName,username,password)
        set.status=StatusCode.OK
        return{
            status:"success",
            data:tableData
        }
    }catch(error){
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            message:error
        }
    }
}
export default getMySQLTableData