import { Context } from "elysia"
import verifyMachine from "../../utils/verifyMachine"
import { StatusCode } from "../../types/types";
import SSHClient from "../../SSHClient/SSHClient";
import decryptVpsPassword from "../../utils/decryptPassword";
import RedisHelper from "../../HelperClasses/RedisHelper";
import { caching } from "../../db/schema";
import { db } from "../../db/client";
const startNewRedis=async({body,set,userId}:Context | any)=>{
    const req=body as {
        name:string,
        password:string,
        vpsId:string,
        vpsIp:string,
        port:string, 
    }
    const {name,password,vpsId,vpsIp,port}=req;
    if(!name || !password || !vpsId || !port || !vpsIp){
        set.status=StatusCode.BAD_REQUEST
        return{
            message:"Invalid request body"
        }
    }
    const isMachineVerified=await verifyMachine(vpsId,userId,vpsIp)
    if(!isMachineVerified.status){
        set.status=StatusCode.BAD_REQUEST
        return{
            message:"unauthorized machine access"
        }
    }
    var ssh:SSHClient|null=null;
    var redis:RedisHelper|null=null;
    const {machine}=isMachineVerified
    try {
        const hashedPassword=await decryptVpsPassword(machine.vps_password)
        ssh=new SSHClient({
            host:machine.vps_ip,
            password:hashedPassword,
            username:"root"
        })
        await ssh.connect()
        redis=new RedisHelper(ssh)
        await redis.installRedisCLI();
       const result= await redis.startNewRedisServer(name,password,port)
       console.log("Redis start result:",result)
       await db.insert(caching).values({
        cacheName:name,
        port:parseInt(port),
        password:password,
        vpsId:parseInt(vpsId),
        userId:parseInt(userId),
        host:vpsIp
       })
       set.status=StatusCode.OK
       return{
        message:"successully created new redis server"
       }
    } catch (error) {
        console.log("Error while starting new redis server",error)
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return{
            message:error
        }
    }finally{
        if(ssh){
            ssh.close();
        }
    }

}
export default startNewRedis