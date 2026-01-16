# app/services/dice_defense/room_manager.py

import asyncio
import secrets
import string
import json
import time
from typing import Dict, List, Optional
from fastapi import WebSocket

# [핵심] 서버 전체를 관장하는 심장 (Global Ticker) 가져오기
from app.core.global_ticker import ticker

class DiceGameRoom:
    """
    [게임 방 객체]
    - 개별 무한 루프(while True)를 돌지 않습니다.
    - GlobalTicker가 0.033초마다 update()를 '콕' 찔러주는 방식입니다.
    - 따라서 서버 자원을 훨씬 효율적으로 쓰고, 모든 방의 시간이 동기화됩니다.
    """
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode  # 'solo', 'coop', 'pvp'
        self.active_connections: List[WebSocket] = []
        self.players: Dict[str, dict] = {} 
        
        # [상태 관리] 게임의 모든 데이터는 여기에 저장됩니다.
        self.game_state = {
            "tick": 0,
            "status": "waiting", # waiting, playing, ended
            "wave": 1,
            "sp": 100, # (임시) 공용 SP, 멀티면 player별로 분리 필요
            "monsters": [], 
            "dices": {} # 위치별 주사위 정보
        }
        
        # [비동기 입력 큐]
        # 유저들의 입력(소환, 합성 등)이 빗발칠 때, 바로 처리하지 않고 여기에 쌓아둡니다.
        # 그리고 틱(Tick)이 돌 때 한꺼번에 순서대로 처리합니다. (동기화 핵심)
        self.input_queue = asyncio.Queue()

    async def connect(self, websocket: WebSocket, user_id: str):
        """유저 접속 처리"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # 플레이어 정보 등록
        self.players[user_id] = {
            "id": user_id, 
            "conn": websocket,
            "entered_at": time.time()
        }
        print(f"[{self.room_code}] User {user_id} Connected. (Total: {len(self.active_connections)})")

        # [멀티 테스트용] 2명이 모이면 자동 시작 알림
        if self.mode == 'pvp' and len(self.players) == 2:
             await self.broadcast({"type": "NOTICE", "msg": "플레이어 2명 입장 완료! 게임 준비!"})

    def disconnect(self, websocket: WebSocket, user_id: str):
        """유저 연결 해제 처리"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.players:
            del self.players[user_id]
        print(f"[{self.room_code}] User {user_id} Disconnected.")

    async def broadcast(self, message: dict):
        """방에 있는 모든 사람에게 메시지 전송"""
        if not self.active_connections:
            return
            
        json_msg = json.dumps(message)
        to_remove = []
        
        for connection in self.active_connections:
            try:
                # 텍스트 모드로 전송 (JSON)
                await connection.send_text(json_msg)
            except Exception:
                to_remove.append(connection)
        
        # 전송 실패한 죽은 연결 정리
        for dead_conn in to_remove:
            if dead_conn in self.active_connections:
                self.active_connections.remove(dead_conn)

    async def push_action(self, user_id: str, action: dict):
        """
        [외부 호출용] 유저의 행동을 큐에 넣습니다.
        WebSocket 라우터에서 이 함수를 호출합니다.
        """
        await self.input_queue.put({"user_id": user_id, "action": action})

    async def update(self):
        """
        [심장 박동] GlobalTicker에 의해 1초에 30번 호출됩니다.
        """
        self.game_state["tick"] += 1
        
        # 1. [입력 처리] 쌓여있는 유저 행동 처리
        while not self.input_queue.empty():
            item = await self.input_queue.get()
            uid = item['user_id']
            act = item['action']
            
            # (예시) 소환 요청이 들어왔다면?
            if act.get('type') == 'SPAWN':
                print(f"[{self.room_code}] Tick {self.game_state['tick']}: {uid} 소환 시도")
                # 실제 로직: SP 확인 -> 주사위 생성 -> 상태 업데이트
                # 여기서는 테스트용으로 브로드캐스트만
                await self.broadcast({
                    "type": "EFFECT", 
                    "effect": "spawn_motion", 
                    "user_id": uid
                })

        # 2. [게임 로직] (몬스터 이동, 타워 공격 등)
        # TODO: self.game_logic.update(self.game_state)
        
        # 3. [상태 전송] 클라이언트 화면 갱신을 위한 데이터 전송
        # 매 틱마다 보내면 대역폭이 너무 크니, 중요한 변경이나 1초(30틱)마다 동기화
        if self.game_state["tick"] % 30 == 0:
            await self.broadcast({
                "type": "TICK",
                "tick": self.game_state["tick"],
                "wave": self.game_state["wave"],
                "sp": self.game_state["sp"]
            })

class DiceRoomManager:
    """
    방 관리자 (Singleton)
    방을 만들 때 Ticker에 구독시키고, 없앨 때 구독 해제하는 역할이 중요합니다.
    """
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    def create_room(self, mode: str = "solo") -> str:
        # 1. 중복되지 않는 방 코드 생성
        while True:
            chars = string.ascii_uppercase + string.digits
            code = ''.join(secrets.choice(chars) for _ in range(6))
            if code not in self._rooms:
                break
        
        # 2. 방 생성
        new_room = DiceGameRoom(code, mode)
        self._rooms[code] = new_room
        
        # 3. [핵심] Global Ticker에 구독 신청!
        # 이제 Ticker가 알아서 이 방의 update()를 주기적으로 호출해줍니다.
        ticker.subscribe(new_room)
        
        print(f"=== [RoomManager] Created Room: {code} (Mode: {mode}) ===")
        return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            room = self._rooms[room_code]
            
            # [핵심] Ticker 구독 해제 (더 이상 update 호출 안 함)
            ticker.unsubscribe(room)
            
            del self._rooms[room_code]
            print(f"=== [RoomManager] Removed Room: {room_code} ===")

# 전역 인스턴스
room_manager = DiceRoomManager()