import { sqliteTable, text, integer, blob, primaryKey } from "drizzle-orm/sqlite-core";
export const teams = sqliteTable("teams", { id: text("id").primaryKey(), state: text("state").notNull(), version: integer("version").notNull().default(0) });
export const credentials = sqliteTable("credentials", { id: text("id").primaryKey(), team: text("team").notNull(), member: text("member").notNull(), hash: text("hash").notNull() });
export const sessions = sqliteTable("sessions", { hash: text("hash").primaryKey(), team: text("team").notNull(), member: text("member").notNull(), expires: integer("expires").notNull() });
export const limits = sqliteTable("limits", { id: text("id").primaryKey(), count: integer("count").notNull(), expires: integer("expires").notNull() });
export const memberPhotos = sqliteTable("member_photos", {team:text("team").notNull(),member:text("member").notNull(),bytes:blob("bytes",{mode:"buffer"}).notNull(),revision:text("revision").notNull()}, table=>[primaryKey({columns:[table.team,table.member]})]);

export const emailAccounts=sqliteTable("email_accounts",{email:text("email").primaryKey(),team:text("team").notNull(),member:text("member").notNull(),password:text("password").notNull(),mustChange:integer("must_change").notNull().default(1),enabled:integer("enabled").notNull().default(1)});

export const sheetLinks=sqliteTable("sheet_links",{team:text("team").primaryKey(),baseline:text("baseline").notNull()});
export const pushSubscriptions=sqliteTable("push_subscriptions",{endpoint:text("endpoint").primaryKey(),team:text("team").notNull(),member:text("member").notNull(),subscription:text("subscription").notNull(),language:text("language").notNull().default("ko")});
export const pushJobs=sqliteTable("push_jobs",{id:text("id").primaryKey(),endpoint:text("endpoint").notNull(),payload:text("payload").notNull(),attempts:integer("attempts").notNull().default(0),nextAt:integer("next_at").notNull().default(0),leaseUntil:integer("lease_until").notNull().default(0)});

export const membershipRequests=sqliteTable("membership_requests",{id:text("id").primaryKey(),team:text("team").notNull(),email:text("email").notNull(),details:text("details").notNull(),status:text("status").notNull().default("pending"),requestedAt:integer("requested_at").notNull()});
