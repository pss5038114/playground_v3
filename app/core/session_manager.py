# app/core/session_manager.py
from typing import Dict, List
from fastapi import WebSocket
import asyncio
from app.services.dice_defense.modes.solo.game import SoloGameSession

class GameSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.players: List[WebSocket] = []
        # [변경] 게임 로직 인스턴스 생성
        self.game = SoloGameSession()
        self.tick_count = 0

    async def add_player(self, websocket: WebSocket):
        await websocket.accept()
        self.players.append(websocket)
        # 접속 시 초기 맵 데이터 전송
        await websocket.send_json({
            "type": "INIT",
            "map": self.game.get_map_data(),
            "state": self.game.get_game_state()
        })

    def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)

    async def broadcast(self, message: dict):
        if not self.players: return
        # 연결이 끊긴 소켓은 리스트에서 제거하며 전송
        to_remove = []
        for p in self.players:
            try:
                await p.send_json(message)
            except:
                to_remove.append(p)
        for p in to_remove:
            if p in self.players: self.players.remove(p)

    async def handle_command(self, data: dict):
        """클라이언트 메시지 처리"""
        cmd = data.get("type")
        self.game.process_command(cmd, data)
        # 명령 처리 후 즉시 상태 업데이트 전송 (반응성 향상)
        await self.broadcast({
            "type": "GAME_STATE",
            "state": self.game.get_game_state()
        })

    async def update(self):
        """Global Ticker에 의해 호출됨"""
        self.tick_count += 1
        self.game.update() # 게임 로직 업데이트
        
        # 30틱(약 1초)마다 동기화 전송 (너무 자주는 부하 발생)
        # 또는 중요한 변화가 있을 때만 보내는 것이 좋음
        if self.tick_count % 5 == 0:  # 약 0.15초마다 갱신
            await self.broadcast({
                "type": "GAME_STATE",
                "state": self.game.get_game_state()
            })

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}

    def get_or_create_session(self, session_id: str) -> GameSession:
        if session_id not in self.active_sessions:
            new_session = GameSession(session_id)
            self.active_sessions[session_id] = new_session
            # Global Ticker에 등록하여 루프 실행
            from app.core.global_ticker import ticker
            ticker.subscribe(new_session)
        return self.active_sessions[session_id]

session_manager = SessionManager()