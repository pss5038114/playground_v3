# app/services/dice_defense/connection_manager.py
from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # game_id: [WebSocket, WebSocket, ...]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket):
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]

    async def broadcast(self, game_id: str, message: dict):
        if game_id in self.active_connections:
            for connection in self.active_connections[game_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    # 연결 끊김 처리 등
                    pass

manager = ConnectionManager()