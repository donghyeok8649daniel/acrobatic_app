CREATE TABLE email_accounts (
 email TEXT PRIMARY KEY NOT NULL,
 team TEXT NOT NULL,
 member TEXT NOT NULL,
 password TEXT NOT NULL,
 must_change INTEGER NOT NULL DEFAULT 1,
 enabled INTEGER NOT NULL DEFAULT 1,
 UNIQUE(team,member)
);
--> statement-breakpoint
CREATE TABLE sheet_links (
 team TEXT PRIMARY KEY NOT NULL,
 baseline TEXT NOT NULL
);
