from typing import Dict, List
from fastapi import WebSocket
import asyncio

class GameSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.players: List[WebSocket] = []
        self.state = {"tick": 0}

    async def add_player(self, websocket: WebSocket):
        await websocket.accept()
        self.players.append(websocket)

    def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)

    async def broadcast(self, message: dict):
        if not self.players: return
        await asyncio.gather(*[p.send_json(message) for p in self.players])

    async def update(self):
        self.state["tick"] += 1
        if self.state["tick"] % 30 == 0:  # 1초마다 전송
            await self.broadcast({
                "type": "TICK",
                "session_id": self.session_id,
                "tick": self.state["tick"]
            })

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}

    def get_or_create_session(self, session_id: str) -> GameSession:
        if session_id not in self.active_sessions:
            new_session = GameSession(session_id)
            self.active_sessions[session_id] = new_session
            from app.core.global_ticker import ticker
            ticker.subscribe(new_session)
        return self.active_sessions[session_id]

session_manager = SessionManager()