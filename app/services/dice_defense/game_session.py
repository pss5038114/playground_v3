import time
from collections import deque
from typing import List, Dict, Deque

class GameSession:
    def __init__(self, session_id: str, user_ids: List[str], mode: str = "single"):
        self.session_id = session_id
        self.user_ids = user_ids
        self.mode = mode
        self.created_at = time.time()
        self.is_active = True
        self.wave = 1
        self.sp = 100
        self.lives = 3
        self.grid: List[object] = [None] * 15 
        self.event_queue: Deque = deque()
        print(f"[GameSession] Created {session_id}")

    def handle_input(self, user_id: str, data: dict):
        self.event_queue.append((user_id, data))

    def update(self, dt: float):
        if not self.is_active: return
        while self.event_queue:
            user_id, action = self.event_queue.popleft()
            # 로직 처리 예정

    def close(self):
        self.is_active = False