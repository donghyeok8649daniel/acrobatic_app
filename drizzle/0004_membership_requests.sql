CREATE TABLE membership_requests (
 id TEXT PRIMARY KEY NOT NULL,
 team TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 details TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 requested_at INTEGER NOT NULL
);
