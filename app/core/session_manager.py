# app/core/session_manager.py
from typing import Dict, List
from fastapi import WebSocket
import logging

# 에러가 나도 서버가 죽지 않도록 try-except import
try:
    from app.services.dice_defense.modes.solo.game import SoloGameSession
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import SoloGameSession: {e}")
    SoloGameSession = None

class GameSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.players: List[WebSocket] = []
        self.game = None
        
        # 게임 세션 초기화 시도
        if SoloGameSession:
            try:
                self.game = SoloGameSession()
            except Exception as e:
                print(f"Error initializing game session {session_id}: {e}")
                self.game = None

    async def add_player(self, websocket: WebSocket):
        await websocket.accept()
        self.players.append(websocket)
        
        if self.game:
            # 초기 데이터 전송
            try:
                await websocket.send_json({
                    "type": "INIT",
                    "map": self.game.get_map_data(),
                    "state": self.game.get_game_state()
                })
            except Exception as e:
                print(f"Error sending INIT data: {e}")
        else:
            # 게임 초기화 실패 시 에러 메시지 전송
            await websocket.send_json({
                "type": "ERROR",
                "message": "Game initialization failed on server."
            })

    def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)

    async def handle_command(self, data: dict):
        if not self.game: return
        
        cmd = data.get("type")
        self.game.process_command(cmd, data)
        
        # 상태 업데이트 브로드캐스트
        await self.broadcast({
            "type": "GAME_STATE",
            "state": self.game.get_game_state()
        })

    async def broadcast(self, message: dict):
        to_remove = []
        for p in self.players:
            try:
                await p.send_json(message)
            except:
                to_remove.append(p)
        for p in to_remove:
            if p in self.players:
                self.players.remove(p)

    async def update(self):
        if self.game:
            self.game.update()

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}

    def get_or_create_session(self, session_id: str) -> GameSession:
        if session_id not in self.active_sessions:
            new_session = GameSession(session_id)
            self.active_sessions[session_id] = new_session
            
            # Global Ticker 등록 (순환 참조 방지 위해 함수 내부 import)
            try:
                from app.core.global_ticker import ticker
                ticker.subscribe(new_session)
            except ImportError:
                print("Warning: Global Ticker not found. Game loop won't run.")
                
        return self.active_sessions[session_id]

session_manager = SessionManager()