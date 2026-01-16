import asyncio
import secrets
import string
import json
from typing import Dict, List, Optional
from fastapi import WebSocket
from app.core.global_ticker import ticker  # [중요] Global Ticker 가져오기

class DiceGameRoom:
    """
    게임 방 (Session)
    - GlobalTicker에 의해 주기적으로 update()가 호출됨.
    - 입력(WebSocket)은 비동기로 받고, 처리는 update()에서 동기로 수행.
    """
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode  # 'solo', 'coop', 'pvp'
        self.active_connections: List[WebSocket] = []
        self.players: Dict[str, dict] = {} 
        
        # 게임 상태 관리
        self.game_state = {
            "tick": 0,
            "wave": 1,
            "enemies": [],
            # 추후 여기에 map, dice_towers 등 추가
        }
        
        self.input_queue = asyncio.Queue() # 유저 입력을 쌓아두는 큐

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # 플레이어 정보 등록
        self.players[user_id] = {
            "id": user_id, 
            "conn": websocket,
            "sp": 100,
            "deck": [] # 추후 DB에서 로드
        }
        print(f"[{self.room_code}] User {user_id} Connected. (Mode: {self.mode})")

        # [멀티플레이 대응] 2명이 다 차면 게임 시작 신호 등을 보낼 수 있음
        if self.mode == 'pvp' and len(self.players) == 2:
             await self.broadcast({"type": "NOTICE", "msg": "모든 플레이어가 입장했습니다. 게임 준비!"})

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.players:
            del self.players[user_id]
        print(f"[{self.room_code}] User {user_id} Disconnected.")

    async def broadcast(self, message: dict):
        """접속된 모든 클라이언트에게 메시지 전송"""
        if not self.active_connections:
            return
            
        # JSON 직렬화 최소화 (성능 최적화)
        json_msg = json.dumps(message)
        to_remove = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                to_remove.append(connection)
        
        # 죽은 연결 정리
        for dead_conn in to_remove:
            if dead_conn in self.active_connections:
                self.active_connections.remove(dead_conn)

    async def push_action(self, user_id: str, action: dict):
        """유저의 행동(소환, 합성 등)을 큐에 넣음 (비동기 -> 동기 변환용)"""
        await self.input_queue.put({"user_id": user_id, "action": action})

    async def update(self):
        """
        [GlobalTicker에 의해 30Hz로 호출됨]
        1. 쌓인 유저 입력 처리
        2. 게임 로직 업데이트 (이동, 충돌, 공격)
        3. 변경된 상태 브로드캐스트
        """
        self.game_state["tick"] += 1
        
        # 1. 입력 처리 (이번 틱에 들어온 요청들 처리)
        while not self.input_queue.empty():
            item = await self.input_queue.get()
            uid = item['user_id']
            act = item['action']
            
            # 예: 소환 요청 처리
            if act.get('type') == 'SPAWN':
                # TODO: SP 체크 및 주사위 생성 로직
                print(f"[{self.game_state['tick']}] {uid} 소환 요청 처리")
                await self.broadcast({"type": "EFFECT", "name": "spawn", "user": uid})

        # 2. 게임 로직 (몬스터 이동, 타워 공격 등)
        # if self.game_logic:
        #     self.game_logic.tick()

        # 3. 상태 전송 (최적화를 위해 매 틱마다 보내지 않고, 중요 이벤트나 0.1초마다 보낼 수도 있음)
        # 지금은 테스트를 위해 30틱(1초)마다 전송
        if self.game_state["tick"] % 30 == 0:
            await self.broadcast({
                "type": "TICK",
                "tick": self.game_state["tick"],
                "wave": self.game_state["wave"]
            })

class DiceRoomManager:
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    def create_room(self, mode: str = "solo") -> str:
        # 1. 방 코드 생성
        while True:
            chars = string.ascii_uppercase + string.digits
            code = ''.join(secrets.choice(chars) for _ in range(6))
            if code not in self._rooms:
                break
        
        # 2. 방 생성 및 GlobalTicker에 등록
        new_room = DiceGameRoom(code, mode)
        self._rooms[code] = new_room
        ticker.subscribe(new_room)  # <--- [핵심] 티커에 구독!
        
        print(f"=== Room Created: {code} (Mode: {mode}) ===")
        return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            room = self._rooms[room_code]
            ticker.unsubscribe(room) # <--- [핵심] 티커 구독 해제!
            del self._rooms[room_code]
            print(f"=== Room Deleted: {room_code} ===")

room_manager = DiceRoomManager()