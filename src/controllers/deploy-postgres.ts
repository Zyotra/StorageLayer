import {Context} from "elysia";
import {StatusCode} from "../types/types";
import verifyMachine from "../utils/verifyMachine";
import SSHClient from "../SSHClient/SSHClient";
import decryptPassword from "../utils/decryptPassword";
import {PostgresSSHHelper} from "../HelperClasses/PostgresHelper";

const deployPostgresController = async ({body,set,userId}:Context | any) => {
    const req = body as { vpsId: string,vpsIp:string, dbName: string,userName:string, password: string,ownerId?:string };
    const {vpsId,vpsIp,dbName,userName,password,ownerId} = req;
    if(!ownerId || !userName || !password || !dbName || !vpsIp || !vpsId){
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
    try {


        const {machine} = isMachineVerified;
        const decryptedPassword = await decryptPassword(password);
        const ssh = new SSHClient({
            host: machine.vps_ip,
            username: "root",
            password: decryptedPassword
        })
        await ssh.connect();

        const pgHelper = new PostgresSSHHelper(ssh);
        await pgHelper.install();
        await pgHelper.start();
        if(ownerId){
            await pgHelper.createUserAndDatabase({database: dbName, username: userName, password: decryptedPassword});
        }else{
            await pgHelper.createDatabase(dbName);
        }
        return {
            status: StatusCode.OK,
            message: "Postgres deployment started successfully"
        }
    }catch (error) {
        return {
            status: StatusCode.INTERNAL_SERVER_ERROR,
            message: error
        }
    }

}

export default deployPostgresController;