import {Context} from "elysia";
import {StatusCode} from "../types/types";
import verifyMachine from "../utils/verifyMachine";
import SSHClient from "../SSHClient/SSHClient";
import decryptPassword from "../utils/decryptPassword";
import {PostgresSSHHelper} from "../HelperClasses/PostgresHelper";
import {db} from "../db/client";
import {deployed_db} from "../db/schema";
import { and, eq } from "drizzle-orm";

const deployPostgresController = async ({body,set,userId}:Context | any) => {
    const req = body as { vpsId: string,vpsIp:string, dbName: string,userName:string, password: string };
    const {vpsId,vpsIp,dbName,userName,password} = req;
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
    var pgHelper:PostgresSSHHelper | null =null
    try {
        const {machine} = isMachineVerified;
        const vpsIp=machine.vps_ip as string;
        const existingDatabase=await db.select().from(deployed_db).where(and(eq(deployed_db.host,vpsIp),eq(deployed_db.dbName,dbName)));
        if(existingDatabase.length){
            set.status=StatusCode.BAD_REQUEST;
            return {
                message:"Database with this name already exists on this machine"
            }
        }
        const decryptedPassword = await decryptPassword(machine.vps_password);
        ssh = new SSHClient({
            host: vpsIp,
            username: "root",
            password: decryptedPassword
        })
        await ssh.connect();
        pgHelper = new PostgresSSHHelper(ssh);
        await pgHelper.install();
        await pgHelper.start();
        await pgHelper.createUserAndDatabase({database: dbName, username: userName, password: password});
        await pgHelper.allowRemoteConnections();
        await db.insert(deployed_db).values({
            dbName:dbName,
            host:vpsIp,
            username:userName,
            password:password,
            dbType:"postgres",
            vpsId:parseInt(vpsId),
            userId:userId,
            status:"running"
        });
        return {
            status: StatusCode.OK,
            message: "Postgres deployment started successfully"
        }
    }catch (error) {
        console.log("Error while deploying database",error)
        if(pgHelper){
            pgHelper.dropDatabase(dbName)
        }
        return {
            status: StatusCode.INTERNAL_SERVER_ERROR,
            message: error
        }
    }finally{
        if(ssh){
            ssh.close();
        }
    }

}

export default deployPostgresController;