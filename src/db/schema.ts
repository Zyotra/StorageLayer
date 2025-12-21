import {pgTable, timestamp, varchar, text, integer, serial} from "drizzle-orm/pg-core";

export const deployed_db=pgTable("deployed_db",{
    id:serial("id").primaryKey(),
    dbName:varchar("db_name").notNull(),
    username:varchar("username").notNull(),
    password:varchar("password").notNull(),
    host:varchar("host").notNull(),
    dbType:varchar("db_type").notNull(),
    vpsId:integer("vps_id").notNull(),
    userId:integer("user_id").notNull(),
    status:varchar("status").notNull(),
    createdAt:timestamp("created_at").defaultNow().notNull()
})
