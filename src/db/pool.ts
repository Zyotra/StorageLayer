import { Pool } from "pg";
const pool=new Pool({
    connectionString:process.env.DEPLOYMENT_MANAGER_DATABASE_URL,
    max:5,
    idleTimeoutMillis:10*1000,
    connectionTimeoutMillis:10*1000
})
export default pool;