import json
from pathlib import Path
import tempfile
import unittest
from bridge import Bridge, Config, Store


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.test_root = (Path(__file__).resolve().parent.parent / '.sites-runtime' / 'bot-tests')
        self.test_root.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=self.test_root)
        self.config = Config('https://club.example', 'x'*48, '123456789012345678', '234567890123456789',
                             'y'*48, database=str(Path(self.directory.name)/'state.sqlite3'))
        self.calls = []
        self.echo = []
        self.fail_send = False

        def transport(url, payload=None, token=None):
            self.calls.append((url, payload))
            if url.endswith('/api/kakao/bridge'):
                return {'reply': '참석 1 / Yes 1'}
            if url.endswith('/query'):
                if 'max(_id)' in payload['query']:
                    return {'data': [{'latest': '100'}]}
                return {'data': self.echo}
            if url.endswith('/reply'):
                if self.fail_send:
                    raise TimeoutError()
                return {'success': True, 'message': 'Enqueued'}
            raise AssertionError(url)
        self.bridge = Bridge(self.config, transport)

    def tearDown(self):
        self.assertEqual(Path(self.directory.name).resolve().parent, self.test_root.resolve())
        self.directory.cleanup()

    def message(self, **changes):
        data = {'_id': '900000000000000001', 'chat_id': self.config.room,
                'user_id': '345678901234567890', 'message': '!yes 2026-11-02'}
        data.update(changes)
        return {'json': data}

    def test_room_identity_and_duplicate_inbox(self):
        self.assertFalse(self.bridge.ingest(self.message(chat_id='other')))
        self.assertFalse(self.bridge.ingest(self.message(user_id=self.config.bot)))
        self.assertFalse(self.bridge.ingest(self.message(message='ordinary private conversation')))
        self.assertTrue(self.bridge.ingest(self.message()))
        self.bridge.ingest(self.message())
        self.bridge.inbox_once()
        self.bridge.inbox_once()
        self.assertEqual(sum(url.endswith('/api/kakao/bridge') for url, _ in self.calls), 1)
        request = self.calls[0][1]
        self.assertEqual(request['sender'], '345678901234567890')
        with self.bridge.store.connect() as db:
            self.assertEqual(db.execute('SELECT body FROM inbox').fetchone()[0], '{}')
            self.assertEqual(db.execute('SELECT count(*) FROM outbox').fetchone()[0], 1)

    def test_enqueue_is_not_confirmed_delivery(self):
        with self.bridge.store.connect() as db:
            Store.enqueue(db, 'test', 'test', 'Training')
        self.bridge.send_once()
        self.assertEqual(self.bridge.store.counts(), {'awaiting': 1})
        self.bridge.reconcile()
        self.assertEqual(self.bridge.store.counts(), {'awaiting': 1})
        self.echo = [{'_id': '101', 'message': 'Training'}]
        self.bridge.reconcile()
        self.assertEqual(self.bridge.store.counts(), {'sent': 1})

    def test_ambiguous_send_survives_restart_without_resending(self):
        with self.bridge.store.connect() as db:
            Store.enqueue(db, 'test', 'test', 'Training')
        self.fail_send = True
        self.bridge.send_once()
        self.assertEqual(self.bridge.store.counts(), {'uncertain': 1})
        restarted = Bridge(self.config, self.bridge.transport)
        restarted.send_once()
        self.assertEqual(sum(url.endswith('/reply') for url, _ in self.calls), 1)
        self.echo = [{'_id': '101', 'message': 'Training'}]
        restarted.reconcile()
        self.assertEqual(restarted.store.counts(), {'sent': 1})

    def test_encrypted_database_is_compared_after_iris_decryption(self):
        with self.bridge.store.connect() as db:
            Store.enqueue(db, 'test', 'test', 'Actual message')
        self.bridge.send_once()
        self.echo = [{'_id': '101', 'message': 'Different message'}]
        self.bridge.reconcile()
        self.assertEqual(self.bridge.store.counts(), {'awaiting': 1})
        query = self.calls[-1][1]
        self.assertIn('message,v', query['query'])
        self.assertNotIn('message=?', query['query'])
        self.echo = [{'_id': '102', 'message': 'Actual message'}]
        self.bridge.reconcile()
        self.assertEqual(self.bridge.store.counts(), {'sent': 1})

    def test_unsent_updates_collapse_and_persist(self):
        event = {'id': 'session', 'date': '2099-11-02', 'url': 'https://club.example/?event=session',
                 'announcement': 'Training', 'attendance': 'Yes 1'}
        self.bridge.store.snapshots({'version': 1, 'events': [event]})
        self.bridge.store.snapshots({'version': 1, 'events': [event]})
        self.assertEqual(self.bridge.store.counts(), {'pending': 1})
        event['attendance'] = 'Yes 2'
        self.bridge.store.snapshots({'version': 2, 'events': [event]})
        self.assertEqual(self.bridge.store.counts(), {'pending': 2})
        event['attendance'] = 'Yes 3'
        self.bridge.store.snapshots({'version': 3, 'events': [event]})
        self.assertEqual(self.bridge.store.counts(), {'pending': 2, 'superseded': 1})
        restarted = Store(self.config.database)
        self.assertEqual(restarted.counts()['pending'], 2)
        with restarted.connect() as db:
            bodies = [r[0] for r in db.execute("SELECT body FROM outbox WHERE status='pending'")]
            self.assertIn('Training\n\nYes 1', bodies)
            self.assertIn('Yes 3', bodies)

    def test_partial_message_is_never_superseded(self):
        with self.bridge.store.connect() as db:
            Store.enqueue(db, 'old', 'guide', 'a'*2000)
            db.execute("UPDATE outbox SET attempts=1,status='sent' WHERE id='old:0'")
            Store.supersede_unstarted(db, 'guide')
            self.assertEqual(db.execute("SELECT status FROM outbox WHERE id='old:1'").fetchone()[0], 'pending')

    def test_missing_training_cancels_unsent_notice(self):
        event = {'id': 'session', 'date': '2099-11-02', 'url': 'https://club.example/',
                 'announcement': 'Training', 'attendance': 'Yes 1'}
        self.bridge.store.snapshots({'version': 1, 'events': [event]})
        self.bridge.store.snapshots({'version': 2, 'events': []})
        self.assertNotIn('pending', self.bridge.store.counts())


if __name__ == '__main__':
    unittest.main()
