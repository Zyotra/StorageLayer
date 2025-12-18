import { Pool } from "pg";
const pool=new Pool({
    connectionString:process.env.DEPLOYMENT_MANAGER_DATABASE_URL
})
export default pool;