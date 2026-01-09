from typing import Dict, List, Optional
from fastapi import WebSocket
import asyncio
from collections import deque
import json

class GameSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.players: List[WebSocket] = []
        
        # [V3 구조] 
        # 1. Hot Data (In-Memory State)
        self.state = {
            "tick": 0,
            "playing": False,
            "wave": 1,
            "sp": 100,
            "grid": [None] * 15,  # 15 Slots
            "mobs": []            # Mob List
        }
        
        # 2. Input Queue (비동기 입력 수집 -> 틱 단위 처리)
        self.input_queue = deque()

    async def add_player(self, websocket: WebSocket):
        await websocket.accept()
        self.players.append(websocket)

    def remove_player(self, websocket: WebSocket):
        if websocket in self.players:
            self.players.remove(websocket)

    async def broadcast(self, message: dict):
        if not self.players: return
        # 연결된 모든 클라이언트에게 전송 (오류 발생 시 연결 해제 처리)
        disconnected = []
        for p in self.players:
            try:
                await p.send_json(message)
            except:
                disconnected.append(p)
        
        for p in disconnected:
            self.remove_player(p)

    def handle_input(self, data: dict):
        """유저 입력을 큐에 적재 (즉시 처리 X)"""
        self.input_queue.append(data)

    def _process_inputs(self):
        """틱 시작 시 큐에 쌓인 입력 일괄 처리"""
        while self.input_queue:
            action = self.input_queue.popleft()
            action_type = action.get("type")
            
            if action_type == "START_GAME":
                self.state["playing"] = True
                asyncio.create_task(self.broadcast({"type": "GAME_START"}))
                
            # TODO: 추후 SP 소환, 합성(Merge) 등 로직 추가

    async def update(self):
        """Global Ticker에 의해 호출되는 1 Frame (30Hz)"""
        # 1. 입력 처리
        self._process_inputs()

        # 2. 게임 로직 (게임 중일 때만)
        if self.state["playing"]:
            self.state["tick"] += 1
            # TODO: 몹 이동, 타워 공격 로직

        # 3. 상태 전송 (최적화를 위해 매 틱마다 보내지 않고 중요 이벤트나 주기적으로 전송)
        # 예시: 1초(30틱)마다 동기화 패킷 전송
        if self.state["tick"] % 30 == 0: 
            await self.broadcast({
                "type": "TICK",
                "tick": self.state["tick"],
                "sp": self.state["sp"]
            })

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}

    def get_or_create_session(self, session_id: str) -> GameSession:
        if session_id not in self.active_sessions:
            new_session = GameSession(session_id)
            self.active_sessions[session_id] = new_session
            
            # Global Ticker 구독
            from app.core.global_ticker import ticker
            ticker.subscribe(new_session)
            
            print(f"✨ New Game Session Created: {session_id}")
            
        return self.active_sessions[session_id]
    
    def remove_session(self, session_id: str):
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            from app.core.global_ticker import ticker
            ticker.unsubscribe(session)
            del self.active_sessions[session_id]
            print(f"🗑️ Session Removed: {session_id}")

session_manager = SessionManager()