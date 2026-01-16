# app/services/dice_defense/room_manager.py
import asyncio
import secrets
import string
import json
from typing import Dict, List, Optional
from fastapi import WebSocket

# Game Logic Import
from app.services.dice_defense.modes.solo.game import SoloGameLogic

class DiceGameRoom:
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode
        self.active_connections: List[WebSocket] = []
        self.players: Dict[str, dict] = {}
        
        # 게임 로직 인스턴스
        self.game_logic = SoloGameLogic()
        
        self.is_running = False
        self._task = None

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.players[user_id] = {"id": user_id}
        
        print(f"[{self.room_code}] User {user_id} Connected.")
        
        # 접속 시 현재 게임 상태 전송
        await websocket.send_json({
            "type": "GAME_STATE", 
            "data": self.game_logic.get_state()
        })

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.players:
            del self.players[user_id]
        print(f"[{self.room_code}] User {user_id} Disconnected.")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        json_msg = json.dumps(message)
        # 연결된 모든 클라이언트에게 전송
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                pass

    async def start_game_loop(self):
        self.is_running = True
        self._task = asyncio.create_task(self._game_loop())

    async def _game_loop(self):
        print(f"[{self.room_code}] Game Loop Started.")
        try:
            while self.is_running:
                # 30Hz (약 0.033초)
                dt = 0.033
                
                # 1. 게임 로직 업데이트
                self.game_logic.update(dt)
                
                # 2. 상태 브로드캐스팅
                state = self.game_logic.get_state()
                await self.broadcast({"type": "GAME_STATE", "data": state})

                await asyncio.sleep(dt)
        except asyncio.CancelledError:
            print(f"[{self.room_code}] Loop Cancelled.")
        finally:
            pass

    def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()

class DiceRoomManager:
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    def create_room(self, mode: str = "solo") -> str:
        while True:
            chars = string.ascii_uppercase + string.digits
            code = ''.join(secrets.choice(chars) for _ in range(6))
            if code not in self._rooms:
                new_room = DiceGameRoom(code, mode)
                self._rooms[code] = new_room
                # 방 생성 즉시 게임 루프 시작
                asyncio.create_task(new_room.start_game_loop())
                print(f"=== Room Created: {code} ===")
                return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            self._rooms[room_code].stop()
            del self._rooms[room_code]
            # [수정] code -> room_code로 변수명 수정 완료
            print(f"=== Room Removed: {room_code} ===")

# 전역 인스턴스
room_manager = DiceRoomManager()