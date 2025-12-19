import {Context} from "elysia";
import {db} from "../db/client";
import {deployed_db} from "../db/schema";
import {eq} from "drizzle-orm";
import {StatusCode} from "../types/types";
const getdbController=async({set,userId}:Context | any)=>{
    try {
        const dbs=await db.select().from(deployed_db).where(eq(deployed_db.userId,userId))
        set.status=StatusCode.OK
        return {
            status:StatusCode.OK,
            data:dbs
        }
    }catch (e) {
        set.status=StatusCode.INTERNAL_SERVER_ERROR
        return {
            status:"invalid request",
            message: e
        }
    }
}
export default getdbController;