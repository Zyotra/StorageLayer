import {Context} from "elysia";
import {StatusCode} from "../types/types";

const deployPostgresController = ({body,set,userId}:Context | any) => {
    const req = body as { vpsId: string,vpsIp:string, dbName: string,userName:string, password: string,ownerId?:string };
    const {vpsId,vpsIp,dbName,userName,password,ownerId} = req;
    if(!ownerId || !userName || !password || !dbName || !vpsIp || !vpsId){
        set.status = StatusCode.BAD_REQUEST;
        return {
            message: "Invalid request body"
        }
    }
    return {
        status: StatusCode.OK,
        message: "Postgres deployment started successfully"
    }

}

export default deployPostgresController;