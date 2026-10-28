CREATE TABLE push_subscriptions (
 endpoint TEXT PRIMARY KEY NOT NULL,
 team TEXT NOT NULL,
 member TEXT NOT NULL,
 subscription TEXT NOT NULL,
 language TEXT NOT NULL DEFAULT 'ko'
);
--> statement-breakpoint
CREATE TABLE push_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 endpoint TEXT NOT NULL,
 payload TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0
);
