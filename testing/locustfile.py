"""
Phase 2 load test — simulates the realistic user flow from the spec:
login -> list notes -> create -> read -> update -> delete.

Each simulated user registers itself first (so runs at any scale don't
collide on usernames), then repeats the notes workflow. Run with:

    uv run locust -f locustfile.py --host=http://127.0.0.1:8000 --headless \
        -u <users> -r <spawn-rate> -t <duration> --csv=../phase-2-results/RAW_RESULTS/locust_<n>users
"""

import random
import uuid

from locust import HttpUser, task, between


class NotesUser(HttpUser):
    wait_time = between(1, 3)  # seconds between tasks, simulating real think-time

    def on_start(self):
        self.username = f'loadtest_{uuid.uuid4().hex[:10]}'
        self.password = 'load-test-password-9'
        self.note_ids = []

        with self.client.get('/api/auth/csrf/', catch_response=True) as r:
            self.csrf = self.client.cookies.get('csrftoken')

        self.client.post(
            '/api/auth/register/',
            json={'username': self.username, 'password': self.password},
            headers={'X-CSRFToken': self.csrf},
            name='/api/auth/register/',
        )
        self.csrf = self.client.cookies.get('csrftoken')
        self.client.post(
            '/api/auth/login/',
            json={'username': self.username, 'password': self.password},
            headers={'X-CSRFToken': self.csrf},
            name='/api/auth/login/',
        )
        self.csrf = self.client.cookies.get('csrftoken')

    @task(3)
    def list_notes(self):
        self.client.get('/api/notes/', name='/api/notes/ [list]')

    @task(2)
    def create_note(self):
        res = self.client.post(
            '/api/notes/',
            json={'title': f'Note {uuid.uuid4().hex[:6]}', 'content': 'Load test content'},
            headers={'X-CSRFToken': self.csrf},
            name='/api/notes/ [create]',
        )
        if res.status_code == 201:
            self.note_ids.append(res.json()['id'])

    @task(2)
    def read_note(self):
        if not self.note_ids:
            return
        note_id = random.choice(self.note_ids)
        self.client.get(f'/api/notes/{note_id}/', name='/api/notes/:id [read]')

    @task(1)
    def update_note(self):
        if not self.note_ids:
            return
        note_id = random.choice(self.note_ids)
        self.client.patch(
            f'/api/notes/{note_id}/',
            json={'content': 'Updated by load test'},
            headers={'X-CSRFToken': self.csrf},
            name='/api/notes/:id [update]',
        )

    @task(1)
    def delete_note(self):
        if not self.note_ids:
            return
        note_id = self.note_ids.pop()
        self.client.delete(
            f'/api/notes/{note_id}/',
            headers={'X-CSRFToken': self.csrf},
            name='/api/notes/:id [delete]',
        )
