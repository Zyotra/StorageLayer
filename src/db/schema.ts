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

export const caching=pgTable("caching",{
    id:serial("id").primaryKey(),
    cacheName:varchar("cache_name").notNull(),
    password:varchar("password").notNull(),
    host:varchar("host").notNull(),
    vpsId:integer("vps_id").notNull(),
    userId:integer("user_id").notNull(),
    port:integer("port").notNull().unique(),
    cachingType:varchar("caching_type").default("redis"),
    status:varchar("status").notNull().default("running"),
    createdAt:timestamp("created_at").defaultNow().notNull()
})