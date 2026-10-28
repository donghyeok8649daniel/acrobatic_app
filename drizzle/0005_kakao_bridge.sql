CREATE TABLE IF NOT EXISTS kakao_links (
 team TEXT NOT NULL, member TEXT NOT NULL, sender TEXT,
 code_hash TEXT, expires INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(team,member), UNIQUE(team,sender)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS kakao_receipts (
 team TEXT NOT NULL, id TEXT NOT NULL, commit_id TEXT NOT NULL,
 reply TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(team,id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS kakao_health (
 team TEXT PRIMARY KEY NOT NULL, checked_at INTEGER NOT NULL,
 iris_ready INTEGER NOT NULL DEFAULT 0, pending INTEGER NOT NULL DEFAULT 0,
 uncertain INTEGER NOT NULL DEFAULT 0
);
