from typing import Dict, List, Optional
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
        self.active_sessions: Dict[str, object] = {}

    def create_session(self, session_id: str, session_obj: object):
        """새로운 게임 세션을 등록하고 티커에 구독시킵니다."""
        self.active_sessions[session_id] = session_obj
        from app.core.global_ticker import ticker
        ticker.subscribe(session_obj)

    def get_session(self, session_id: str) -> Optional[object]:
        """세션 ID로 활성화된 세션을 찾습니다."""
        return self.active_sessions.get(session_id)

    def remove_session(self, session_id: str):
        """세션을 종료하고 티커 구독을 해제합니다."""
        if session_id in self.active_sessions:
            session = self.active_sessions.pop(session_id)
            from app.core.global_ticker import ticker
            ticker.unsubscribe(session)
            if hasattr(session, 'close'):
                session.close()

session_manager = SessionManager()