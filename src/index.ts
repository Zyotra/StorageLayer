import { Elysia } from "elysia";
import {config} from "dotenv";
import {cors} from "@elysiajs/cors"
import checkAuth from "./middlewares/checkAuth";
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
    .post("/deploy-postgres",()=>{
        return {
            status:"success",
            message:"Redis instance created successfully"
        }
    })
app.listen(process.env.PORT as string)
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
