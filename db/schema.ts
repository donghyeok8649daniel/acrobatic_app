import { sqliteTable, text, integer, blob, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
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
export const kakaoLinks=sqliteTable('kakao_links',{team:text('team').notNull(),member:text('member').notNull(),sender:text('sender'),codeHash:text('code_hash'),expires:integer('expires').notNull().default(0)},t=>[primaryKey({columns:[t.team,t.member]}),uniqueIndex('kakao_links_team_sender').on(t.team,t.sender)]);
export const kakaoReceipts=sqliteTable('kakao_receipts',{team:text('team').notNull(),id:text('id').notNull(),commitId:text('commit_id').notNull(),reply:text('reply').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.team,t.id]})]);
export const kakaoHealth=sqliteTable('kakao_health',{team:text('team').primaryKey(),checkedAt:integer('checked_at').notNull(),irisReady:integer('iris_ready').notNull().default(0),pending:integer('pending').notNull().default(0),uncertain:integer('uncertain').notNull().default(0)});
