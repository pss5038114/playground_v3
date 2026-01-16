# app/services/dice_defense/room_manager.py
import asyncio
import secrets
import string
import json
from typing import Dict, List, Optional
from fastapi import WebSocket

# [수정됨] SoloGameLogic import
from app.services.dice_defense.modes.solo.game import SoloGameLogic

class DiceGameRoom:
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode
        self.active_connections: List[WebSocket] = []
        self.players: Dict[str, dict] = {}
        
        # [수정됨] 게임 로직 인스턴스화
        if mode == 'solo':
            self.game_logic = SoloGameLogic()
        else:
            self.game_logic = None # 추후 다른 모드 추가
            
        self.is_running = False
        self._task = None

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.players[user_id] = {"id": user_id}
        print(f"[{self.room_code}] User {user_id} joined.")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.players:
            del self.players[user_id]
        print(f"[{self.room_code}] User {user_id} left.")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        json_msg = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                pass

    async def start_game_loop(self):
        self.is_running = True
        self._task = asyncio.create_task(self._game_loop())

    async def _game_loop(self):
        print(f"[{self.room_code}] Loop Start")
        try:
            while self.is_running:
                dt = 0.033 # 약 30 FPS
                
                # [수정됨] 게임 로직 업데이트 및 상태 전송
                if self.game_logic:
                    # 1. 로직 업데이트 (Move, Spawn, Wave Check)
                    self.game_logic.update(dt)
                    
                    # 2. 상태 스냅샷 가져오기
                    state = self.game_logic.get_state()
                    
                    # 3. 클라이언트로 전송 (GAME_STATE)
                    await self.broadcast({
                        "type": "GAME_STATE",
                        "data": state
                    })

                await asyncio.sleep(dt)
        except asyncio.CancelledError:
            print(f"[{self.room_code}] Loop Cancelled")
        finally:
            print(f"[{self.room_code}] Loop Stopped")

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
                asyncio.create_task(new_room.start_game_loop())
                print(f"=== Room Created: {code} ({mode}) ===")
                return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            self._rooms[room_code].stop()
            del self._rooms[room_code]
            print(f"=== Room Deleted: {room_code} ===")

room_manager = DiceRoomManager()