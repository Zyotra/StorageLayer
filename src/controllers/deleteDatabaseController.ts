import {Context} from "elysia";
import {StatusCode} from "../types/types";
import verifyMachine from "../utils/verifyMachine";
import SSHClient from "../SSHClient/SSHClient";
import decryptPassword from "../utils/decryptPassword";
import {PostgresSSHHelper} from "../HelperClasses/PostgresHelper";

const deleteDatabaseController=async({body,params,set,userId}:Context | any)=>{
    const req=body as {dbName:string,vpsIp:string,vpsId:string}
    const {dbName,vpsIp,vpsId}=req;
    if(!dbName || !vpsIp || !vpsId){
        set.status=StatusCode.BAD_REQUEST;
        return {
            message:"Invalid request body"
        }
    }
    const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp);
    if(!isMachineVerified.status){
        set.status=StatusCode.FORBIDDEN;
        return {
            message:"Unauthorized access for the machine"
        }
    }
    const {machine}=isMachineVerified;
    try {
        const hashedPassword = await decryptPassword(machine.vps_password);
        const ssh = new SSHClient({
            host: machine.vps_ip,
            username: "root",
            password: hashedPassword
        })
        await ssh.connect();
        const pgHelper = new PostgresSSHHelper(ssh);
        await pgHelper.dropDatabase(dbName);
        return {
            status: StatusCode.OK,
            message: "Database deleted successfully"
        }
    }catch (error) {
        set.status=StatusCode.INTERNAL_SERVER_ERROR;
        return {
            status:"invalid request",
            message: error
        }
    }
}
export default deleteDatabaseController;