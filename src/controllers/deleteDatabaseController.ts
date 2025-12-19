import {Context} from "elysia";
import {StatusCode} from "../types/types";
import verifyMachine from "../utils/verifyMachine";
import SSHClient from "../SSHClient/SSHClient";
import decryptPassword from "../utils/decryptPassword";
import {PostgresSSHHelper} from "../HelperClasses/PostgresHelper";
import { deployed_db } from "../db/schema";
import { db } from "../db/client";
import { eq } from "drizzle-orm";

const deleteDatabaseController=async({body,params,set,userId}:Context | any)=>{
    const req=body as {dbName:string,vpsIp:string,vpsId:string}
    const databaseId=params.id;
    if(!databaseId){
        set.status=StatusCode.BAD_REQUEST;
        return {
            message:"Database ID is required"
        }
    }
    const database=await db.select().from(deployed_db).where(eq(deployed_db.id,databaseId));
    if(!database){
        set.status=StatusCode.NOT_FOUND;
        return {
            message:"Database not found"
        }
    }
    const vpsId=database[0].vpsId;
    const vpsIp=database[0].host;
    const isMachineVerified=await verifyMachine(vpsId.toString(),userId,vpsIp);
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
        await pgHelper.dropDatabase(database[0].dbName);
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