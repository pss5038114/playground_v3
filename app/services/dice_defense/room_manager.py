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
            "monsters": [], # 현재 맵에 있는 몬스터들
            
            # [임시 경로 데이터] 
            # 사용자 요청: (0.5, 0) 시작 -> 길 따라 이동 -> 마지막 방어선
            # 예시로 'ㄷ'자 비슷하게 꺾이는 경로를 넣어둠. 좌표 수정해서 쓰세요!
            "path": [
                {"x": 0.5, "y": 0},   # [0] 시작점
                {"x": 0.5, "y": 2.5}, # [1] 아래로 이동
                {"x": 4.5, "y": 2.5}, # [2] 오른쪽으로 이동
                {"x": 4.5, "y": 0}    # [3] 위로 이동 (도착 시 소멸)
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

        if self.mode == 'pvp' and len(self.players) == 2:
             await self.broadcast({"type": "NOTICE", "msg": "Game Start!"})

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

    # =================================================================
    # [핵심 로직] GlobalTicker에 의해 1초에 30번 호출됨
    # =================================================================
    async def update(self):
        self.game_state["tick"] += 1
        
        # 1. 유저 입력 처리
        while not self.input_queue.empty():
            item = await self.input_queue.get()
            # (소환, 합성 로직 등 추후 구현)

        # 2. [몬스터 스폰] 1초(30틱)마다 생성
        if self.game_state["tick"] % 30 == 0:
            self.spawn_monster()

        # 3. [몬스터 이동]
        self.move_monsters()
        
        # 4. [상태 전송] 매 틱마다 위치 정보를 줍니다 (부드러운 이동을 위해)
        # 데이터량이 많아지면 "tick % 3 == 0" 등으로 조절 가능
        await self.broadcast({
            "type": "TICK",
            "tick": self.game_state["tick"],
            "monsters": self.game_state["monsters"]
        })

    def spawn_monster(self):
        """몬스터 한 마리를 시작점에 소환"""
        path = self.game_state["path"]
        if not path: return

        self.monster_id_counter += 1
        start_node = path[0]

        new_monster = {
            "id": self.monster_id_counter,
            "x": start_node["x"],
            "y": start_node["y"],
            "hp": 100,
            "max_hp": 100,
            "speed": 0.05, # 이동 속도 (틱당 0.05칸 이동)
            "path_idx": 0, # 현재 출발한 웨이포인트 인덱스
            "finished": False
        }
        self.game_state["monsters"].append(new_monster)
        # print(f"[{self.room_code}] Monster {new_monster['id']} Spawned!")

    def move_monsters(self):
        """모든 몬스터를 경로 따라 이동시킴"""
        path = self.game_state["path"]
        alive_monsters = []

        for mon in self.game_state["monsters"]:
            # 이미 도착한 놈은 패스
            if mon["finished"]:
                continue

            # 다음 목표 지점 찾기
            target_idx = mon["path_idx"] + 1
            
            # 더 이상 갈 곳이 없으면(마지막 지점 도달) -> 삭제 대상
            if target_idx >= len(path):
                mon["finished"] = True # 여기서 라이프 깎는 로직 추가 가능
                continue

            target = path[target_idx]
            
            # 목표까지의 거리와 방향 계산
            dx = target["x"] - mon["x"]
            dy = target["y"] - mon["y"]
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist <= mon["speed"]:
                # 1틱 안에 도착 가능한 거리면 -> 목표 점으로 강제 이동 후, 다음 경로로 설정
                mon["x"] = target["x"]
                mon["y"] = target["y"]
                mon["path_idx"] += 1
            else:
                # 목표 방향으로 speed만큼 이동
                ratio = mon["speed"] / dist
                mon["x"] += dx * ratio
                mon["y"] += dy * ratio
            
            alive_monsters.append(mon)

        # 살아있는 몬스터만 남김 (도착한 애들 삭제)
        self.game_state["monsters"] = alive_monsters

class DiceRoomManager:
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    def create_room(self, mode: str = "solo") -> str:
        while True:
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
            if code not in self._rooms: break
        
        new_room = DiceGameRoom(code, mode)
        self._rooms[code] = new_room
        ticker.subscribe(new_room) # 구독!
        
        print(f"=== Room Created: {code} ===")
        return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            ticker.unsubscribe(self._rooms[room_code]) # 구독 해제!
            del self._rooms[room_code]

room_manager = DiceRoomManager()