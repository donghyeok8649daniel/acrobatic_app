"""Room-scoped Iris adapter. Python standard library only; no Kakao credentials.

The app remains the authority for member identity and RSVPs. SQLite makes the
inbox/outbox survive restarts. Iris /reply success means Enqueued, not delivered:
we wait for the bot's own new chat log before recording an outgoing message as
confirmed. Ambiguous sends are reconciled, never blindly resent.
"""
import hashlib
import hmac
import json
import logging
import os
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

LOG = logging.getLogger("acrobatic-bridge")
COMMAND = re.compile(r"^!(연결|link|참석|불참|미정|yes|no|maybe|현황|status|가이드|guide|도움말|help)(?:\s|$)", re.I)


@dataclass
class Config:
    origin: str
    token: str
    room: str
    bot: str
    webhook_token: str
    iris: str = "http://redroid:3000"
    callback: str = "http://bridge:8790"
    database: str = "/data/bridge.sqlite3"
    interval: int = 10

    @classmethod
    def from_env(cls):
        result = cls(os.environ["APP_ORIGIN"].rstrip("/"), os.environ["KAKAO_BRIDGE_TOKEN"],
                     os.environ["KAKAO_ROOM_ID"], os.environ.get("KAKAO_BOT_ID", ""),
                     os.environ["IRIS_WEBHOOK_TOKEN"], os.environ.get("IRIS_URL", "http://redroid:3000"),
                     os.environ.get("CALLBACK_ORIGIN", "http://bridge:8790"),
                     os.environ.get("BRIDGE_DATABASE", "/data/bridge.sqlite3"))
        if urlsplit(result.origin).scheme != "https" or urlsplit(result.origin).username:
            raise ValueError("APP_ORIGIN must be an HTTPS app origin")
        if len(result.token) < 32 or len(result.webhook_token) < 32 or not re.fullmatch(r"\d{1,30}", result.room):
            raise ValueError("Missing bridge configuration")
        if result.bot and not re.fullmatch(r"\d{1,30}", result.bot):
            raise ValueError("Invalid bot ID")
        return result


def request_json(url, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
    with urlopen(req, timeout=15) as result:
        return json.load(result)


class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()
        with self.connect() as db:
            db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY, body TEXT NOT NULL, done INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, topic TEXT NOT NULL, body TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending', baseline TEXT, created REAL NOT NULL,
              attempted REAL DEFAULT 0, attempts INTEGER DEFAULT 0, next_at REAL DEFAULT 0);
            UPDATE outbox SET status='uncertain' WHERE status='sending';
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def incoming(self, message):
        with self.lock, self.connect() as db:
            db.execute("INSERT OR IGNORE INTO inbox(id,body) VALUES (?,?)", (message["id"], json.dumps(message)))

    @staticmethod
    def enqueue(db, key, topic, text):
        # Respect message size limits. Persist every part before sending any.
        for index in range(0, len(text), 1800):
            piece = text[index:index + 1800]
            db.execute("INSERT OR IGNORE INTO outbox(id,topic,body,created) VALUES (?,?,?,?)",
                       (key + ":" + str(index // 1800), topic, piece, time.time()))

    @staticmethod
    def supersede_unstarted(db, topic):
        for row in db.execute("SELECT id FROM outbox WHERE topic=? AND status='pending'", (topic,)).fetchall():
            prefix = row['id'].rsplit(':', 1)[0] + ':'
            started = db.execute('SELECT 1 FROM outbox WHERE substr(id,1,?)=? AND attempts>0 LIMIT 1', (len(prefix), prefix)).fetchone()
            if not started:
                db.execute("UPDATE outbox SET status='superseded' WHERE id=?", (row['id'],))

    def snapshots(self, snapshot):
        with self.lock, self.connect() as db:
            current_ids = set()
            for event in snapshot["events"]:
                key = event["id"]
                current_ids.add(key)
                row = db.execute("SELECT body FROM snapshots WHERE id=?", (key,)).fetchone()
                old = json.loads(row[0]) if row else None
                announcement_changed = not old or old["announcement"] != event["announcement"]
                attendance_changed = not old or old["attendance"] != event["attendance"]
                if announcement_changed or attendance_changed:
                    text = (event["announcement"] + "\n\n" if announcement_changed else "") + event["attendance"]
                    # A new RSVP must never replace an unsent training announcement.
                    topic = ("announcement:" if announcement_changed else "attendance:") + key
                    # Never cut off a multi-part message whose first part was sent.
                    self.supersede_unstarted(db, topic)
                    duplicate = db.execute("SELECT 1 FROM outbox WHERE body=? AND created>? AND status IN ('pending','sending','awaiting','sent')", (text, time.time()-60)).fetchone()
                    if not duplicate:
                        self.enqueue(db, "snapshot:" + str(snapshot["version"]) + ":" + key, topic, text)
                db.execute("INSERT INTO snapshots(id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body", (key, json.dumps(event)))
            for row in db.execute("SELECT id,body FROM snapshots").fetchall():
                if row["id"] not in current_ids:
                    event = json.loads(row["body"])
                    topics = ('announcement:' + row['id'], 'attendance:' + row['id'])
                    attempted = db.execute("SELECT 1 FROM outbox WHERE topic IN (?,?) AND status IN ('sent','sending','awaiting','uncertain')", topics).fetchone()
                    for topic in topics:
                        self.supersede_unstarted(db, topic)
                    today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
                    if attempted and event["date"] >= today:
                        self.enqueue(db, "removed:" + str(snapshot["version"]) + ":" + row["id"], 'announcement:' + row['id'],
                                     "[훈련공지 변경 / Training notice changed]\n등록된 훈련공지가 제거되었어. 앱에서 확인해줘. / This training notice was removed.\n" + event["url"])
                    db.execute("DELETE FROM snapshots WHERE id=?", (row["id"],))
            # Keep dedupe rows for 7 days. Unprocessed or ambiguous jobs are never pruned.
            db.execute("DELETE FROM outbox WHERE created<? AND status IN ('sent','superseded')", (time.time()-7*86400,))

    def counts(self):
        with self.connect() as db:
            return dict(db.execute("SELECT status,count(*) FROM outbox GROUP BY status").fetchall())


class Bridge:
    def __init__(self, config, transport=request_json):
        self.config = config
        self.store = Store(config.database)
        self.transport = transport
        self.iris_ready = False

    def iris(self, path, payload=None):
        return self.transport(self.config.iris.rstrip("/") + path, payload)

    def app(self, payload):
        return self.transport(self.config.origin + "/api/kakao/bridge", payload, self.config.token)

    def query(self, sql, bind):
        result = self.iris("/query", {"query": sql, "bind": bind})
        if result.get("error") or not isinstance(result.get("data"), list):
            raise ValueError("Iris database unavailable")
        return result["data"]

    def check_iris(self):
        self.iris_ready = False
        info = self.iris("/config")
        detected = str(info.get("bot_id", ""))
        if not detected.isdigit() or int(detected) <= 0 or (self.config.bot and self.config.bot != detected):
            raise ValueError("Iris bot identity unavailable or changed")
        self.config.bot = detected
        # A running HTTP server alone does not prove the room/database is available.
        rows = self.query("SELECT count(*) AS n FROM chat_logs WHERE chat_id=?", [self.config.room])
        if not rows or int(rows[0].get("n") or 0) < 1:
            raise ValueError("Configured chat room not present")
        endpoint = self.config.callback.rstrip("/") + "/iris/" + self.config.webhook_token
        if info.get("web_server_endpoint") != endpoint:
            result = self.iris("/config/endpoint", {"endpoint": endpoint})
            if result.get("success") is False:
                raise ValueError("Iris webhook configuration rejected")
        self.iris("/config/types", {"types": [1], "include_system_events": False})
        self.iris_ready = True

    def ingest(self, payload):
        raw = payload.get("json", {})
        # Never match room or member names; they are mutable and non-unique.
        room, sender = (str(raw.get(k, "")) for k in ("chat_id", "user_id"))
        identifier = str(raw.get('id') or raw.get('_id', ''))
        text = raw.get("message", payload.get("msg", ""))
        if room != self.config.room or sender == self.config.bot or not all(re.fullmatch(r"\d{1,30}", x) for x in (sender, identifier)):
            return False
        if not isinstance(text, str) or len(text) > 300 or not COMMAND.match(text.strip()):
            return False
        self.store.incoming({"id": identifier, "room": room, "sender": sender, "text": text.strip()})
        return True

    def inbox_once(self):
        with self.store.connect() as db:
            row = db.execute("SELECT id,body FROM inbox WHERE done=0 ORDER BY rowid LIMIT 1").fetchone()
        if not row:
            return
        result = self.app({"action": "message", **json.loads(row["body"])})
        with self.store.lock, self.store.connect() as db:
            if result.get("reply"):
                self.store.enqueue(db, "reply:" + row["id"], "reply:" + row["id"], result["reply"])
            db.execute("UPDATE inbox SET done=1,body='{}' WHERE id=?", (row["id"],))

    def poll(self):
        counts = self.store.counts()
        result = self.app({"action": "snapshot", "irisReady": self.iris_ready,
                           "pending": sum(counts.get(k, 0) for k in ("pending", "sending", "awaiting")),
                           "uncertain": counts.get("uncertain", 0)})
        self.store.snapshots(result)

    def reconcile(self):
        with self.store.connect() as db:
            rows = db.execute("SELECT * FROM outbox WHERE status IN ('awaiting','uncertain') ORDER BY created LIMIT 20").fetchall()
        for row in rows:
            # message is encrypted in SQLite. Filter metadata in SQL, then compare
            # Iris-decrypted text. v + user_id are required for Iris decryption.
            candidates = self.query("SELECT _id,id,user_id,message,v FROM chat_logs WHERE chat_id=? AND user_id=? AND _id>? ORDER BY _id ASC LIMIT 100",
                                    [self.config.room, self.config.bot, row["baseline"] or "0"])
            found = any(candidate.get('message') == row['body'] for candidate in candidates)
            status = "sent" if found else ("uncertain" if time.time()-row["attempted"] > 60 else row["status"])
            with self.store.connect() as db:
                db.execute("UPDATE outbox SET status=? WHERE id=?", (status, row["id"]))

    def send_once(self):
        with self.store.connect() as db:
            # Do not overtake an unconfirmed earlier send: keeps summaries in order.
            if db.execute("SELECT 1 FROM outbox WHERE status IN ('sending','awaiting','uncertain') LIMIT 1").fetchone():
                return
            row = db.execute("SELECT * FROM outbox WHERE status='pending' AND next_at<=? ORDER BY created,rowid LIMIT 1", (time.time(),)).fetchone()
        if not row:
            return
        records = self.query("SELECT max(_id) AS latest FROM chat_logs WHERE chat_id=? AND user_id=?", [self.config.room, self.config.bot])
        baseline = str(records[0].get("latest") or "0") if records else "0"
        with self.store.connect() as db:
            db.execute("UPDATE outbox SET status='sending',baseline=?,attempted=?,attempts=attempts+1 WHERE id=?", (baseline, time.time(), row["id"]))
        # A timeout may occur after enqueue. Retrying could double-post; reconcile it.
        status = "uncertain"
        try:
            result = self.iris("/reply", {"type": "text", "room": self.config.room, "data": row["body"]})
            status = "awaiting" if result.get("success") is True else "pending"
        except HTTPError as error:
            status = "pending" if 400 <= error.code < 500 else "uncertain"
        except Exception:
            pass
        with self.store.connect() as db:
            if status == "pending" and row["attempts"] >= 7:
                status = "uncertain"
            db.execute("UPDATE outbox SET status=?,next_at=? WHERE id=?", (status, time.time()+min(300, 2**(row["attempts"]+1)), row["id"]))

    def run(self):
        next_check = next_poll = 0
        while True:
            try:
                if time.time() >= next_check:
                    self.check_iris()
                    next_check = time.time()+30
                if time.time() >= next_poll:
                    self.poll()
                    next_poll = time.time()+self.config.interval
                if self.iris_ready:
                    self.inbox_once()
                    self.reconcile()
                    self.send_once()
            except Exception as error:
                self.iris_ready = False
                next_check = time.time()+10
                next_poll = time.time()+10
                # Never log request URLs, commands, group messages or secrets.
                LOG.warning("Bridge cycle needs attention (%s)", type(error).__name__)
                try:
                    counts = self.store.counts()
                    self.app({"action": "snapshot", "irisReady": False,
                              "pending": counts.get("pending", 0), "uncertain": counts.get("uncertain", 0)})
                except Exception:
                    pass
            time.sleep(1)


def serve(bridge):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            if self.path != "/health":
                self.send_error(404)
                return
            body = json.dumps({"running": True, "irisReady": bridge.iris_ready, **bridge.store.counts()}).encode()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            if not hmac.compare_digest(self.path, "/iris/" + bridge.config.webhook_token):
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 16384:
                    self.send_error(413)
                    return
                bridge.ingest(json.loads(self.rfile.read(length)))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            except Exception:
                self.send_error(400)
    ThreadingHTTPServer(("0.0.0.0", 8790), Handler).serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    bridge = Bridge(Config.from_env())
    threading.Thread(target=serve, args=(bridge,), daemon=True).start()
    bridge.run()
