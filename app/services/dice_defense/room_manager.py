import asyncio
import secrets
import string
import json
import time
import math
from typing import Dict, List, Optional
from fastapi import WebSocket

# [중요] 서버 심장박동 (Global Ticker)
from app.core.global_ticker import ticker

class DiceGameRoom:
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode
        self.active_connections: List[WebSocket] = []
        self.players: Dict[str, dict] = {} 
        
        # [게임 상태]
        self.game_state = {
            "tick": 0,
            "wave": 1,
            "sp": 100,
            "monsters": [],
            # 경로 데이터 (클라이언트와 좌표 일치)
            "path": [
                {"x": 0.5, "y": 0.0},
                {"x": 0.5, "y": 3.5},
                {"x": 6.5, "y": 3.5},
                {"x": 6.5, "y": 0.0}
            ]
        }
        
        self.input_queue = asyncio.Queue()
        self.monster_id_counter = 0

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        self.players[user_id] = {
            "id": user_id, 
            "conn": websocket,
            "entered_at": time.time()
        }
        print(f"[{self.room_code}] User {user_id} Connected.")

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
        to_remove = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                to_remove.append(connection)
        for dead in to_remove:
            if dead in self.active_connections: self.active_connections.remove(dead)

    async def push_action(self, user_id: str, action: dict):
        await self.input_queue.put({"user_id": user_id, "action": action})

    async def update(self):
        self.game_state["tick"] += 1
        
        # 1. 몬스터 스폰 (1초마다)
        if self.game_state["tick"] % 30 == 0:
            self.spawn_monster()
            
        # 2. 몬스터 이동
        self.move_monsters()
        
        # 3. 클라이언트로 전송
        await self.broadcast({
            "type": "TICK",
            "tick": self.game_state["tick"],
            "wave": self.game_state["wave"],
            "monsters": self.game_state["monsters"]
        })

    def spawn_monster(self):
        path = self.game_state["path"]
        if not path: return
        
        self.monster_id_counter += 1
        start = path[0]
        
        self.game_state["monsters"].append({
            "id": self.monster_id_counter,
            "x": start["x"],
            "y": start["y"],
            "hp": 100,
            "max_hp": 100,
            "speed": 0.05,
            "path_idx": 0,
            "finished": False
        })

    def move_monsters(self):
        path = self.game_state["path"]
        active_monsters = []
        
        for mon in self.game_state["monsters"]:
            if mon["finished"]: continue
            
            target_idx = mon["path_idx"] + 1
            if target_idx >= len(path):
                mon["finished"] = True 
                continue
                
            target = path[target_idx]
            dx = target["x"] - mon["x"]
            dy = target["y"] - mon["y"]
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist <= mon["speed"]:
                mon["x"] = target["x"]
                mon["y"] = target["y"]
                mon["path_idx"] += 1
            else:
                ratio = mon["speed"] / dist
                mon["x"] += dx * ratio
                mon["y"] += dy * ratio
            
            active_monsters.append(mon)
            
        self.game_state["monsters"] = active_monsters

class DiceRoomManager:
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    # [수정됨] 특정 코드로 방 생성 가능하도록 변경
    def create_room(self, mode: str = "solo", room_code: str = None) -> str:
        if room_code:
            code = room_code
        else:
            while True:
                code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
                if code not in self._rooms: break
        
        new_room = DiceGameRoom(code, mode)
        self._rooms[code] = new_room
        ticker.subscribe(new_room)
        
        print(f"=== Room Created: {code} (Mode: {mode}) ===")
        return code

    # [핵심 수정] TEST_ROOM 요청 시 방이 없으면 자동 생성!
    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        room = self._rooms.get(room_code)
        
        # 개발용: TEST_ROOM이 없으면 즉시 만든다
        if room is None and room_code == "TEST_ROOM":
            print("🛠️ [Debug] 'TEST_ROOM'이 없어서 자동으로 생성합니다...")
            self.create_room("solo", "TEST_ROOM")
            return self._rooms.get("TEST_ROOM")
            
        return room

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            ticker.unsubscribe(self._rooms[room_code])
            del self._rooms[room_code]

room_manager = DiceRoomManager()