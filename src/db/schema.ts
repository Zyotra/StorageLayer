import {pgTable, timestamp, varchar, text, integer, serial} from "drizzle-orm/pg-core";

export const databases=pgTable("databases",{
    id:serial("id").primaryKey(),
    db_name:varchar("name").notNull(),
    username:varchar("username").notNull(),
    password:varchar("").notNull(),
    db_owner:varchar("db_owner").notNull(),
    host:varchar("host").notNull(),
    db_type:varchar("db_type").notNull(),
    vpsId:integer("vpsId").notNull(),
    userId:integer("userId").notNull(),
    status:varchar("status").notNull(),
    created_at:timestamp("created_at").notNull()
})
