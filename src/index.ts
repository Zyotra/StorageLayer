import { Elysia } from "elysia";
import {config} from "dotenv";
import {cors} from "@elysiajs/cors"
import checkAuth from "./middlewares/checkAuth";
import deployPostgresController from "./controllers/deploy-postgres";
import deleteDatabaseController from "./controllers/deleteDatabaseController";
import getdbController from "./controllers/getdbController";
import getTablesListController from "./controllers/getTablesListController";
import getTableData from "./controllers/getTableData";
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
app.listen(process.env.PORT as string)
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
