import { Elysia } from "elysia";
import {config} from "dotenv";
import {cors} from "@elysiajs/cors"
import checkAuth from "./middlewares/checkAuth";
import deployPostgresController from "./controllers/deploy-postgres";
import deleteDatabaseController from "./controllers/deleteDatabaseController";
import getdbController from "./controllers/getdbController";
import getTablesListController from "./controllers/getTablesListController";
import getTableData from "./controllers/getTableData";
import runQuery from "./controllers/runQuery";
import deleteMySQL from "./controllers/MySQL/deleteMySQL";
import deployMySQL from "./controllers/MySQL/deployMySQL";
import getMySQLTableList from "./controllers/MySQL/getMySQLTableList";
import backupMySQL from "./controllers/MySQL/backupMySQL";
import backupPostgres from "./controllers/backupPostgres";
import runMySQLQuery from "./controllers/MySQL/runMySQLQuery";
import getMySQLTableData from "./controllers/MySQL/getTableDataMySQL";
import startNewRedis from "./controllers/Redis/startNewRedis";
import deleteRedisServer from "./controllers/Redis/deleteRedisServer";
import stopRedisServer from "./controllers/Redis/stopRedisServer";
config()
const app = new Elysia();
const origins = ["http://localhost:5173","https://zyotraportal.ramkrishna.cloud"];
app.use(cors({
    allowedHeaders: ["Content-Type", "Authorization"],
    origin: origins,
    methods: ["GET", "POST", "PUT", "DELETE"]
}))


app.get("/",()=>{
    return {
        status:"success",
        message:"Storage Layer of Zyotra is running",
        Timestamp:new Date().toISOString()
    }
})
app
    .use(checkAuth)
    .post("/deploy-postgres",deployPostgresController)
    .delete("/delete-db/:id",deleteDatabaseController)
    .get("/get-db",getdbController)
    .post("/get-tables-list",getTablesListController)
    .post("/get-table-data",getTableData)
    .post("/run-query",runQuery)
    .post("/deploy-mysql",deployMySQL)
    .post("/delete-mysql",deleteMySQL)
    .post("/get-mysql-table-list",getMySQLTableList)
    .post("/get-mysql-table-data",getMySQLTableData)
    .post("/run-mysql-query",runMySQLQuery)
    .post("/backup-mysql-db",backupMySQL)
    .post("/backup-postgres-db",backupPostgres)
    .post("/deploy-redis-cache",startNewRedis)
    .post("/stop-redis-server",stopRedisServer)
    .post("/delete-redis-server",deleteRedisServer)
app.listen(process.env.PORT as string)
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
