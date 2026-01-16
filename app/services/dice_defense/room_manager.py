import asyncio
import secrets
import string
import json
from typing import Dict, List, Optional
from fastapi import WebSocket

# 추후 구현할 실제 게임 로직(SoloGameLogic)을 import
# from .modes.solo.game import SoloGameLogic 

class DiceGameRoom:
    """
    개별 게임 방 클래스
    - 게임 상태(Logic)와 연결된 플레이어(Socket)를 관리
    - 자체적인 틱(Tick) 루프를 돌림
    """
    def __init__(self, room_code: str, mode: str):
        self.room_code = room_code
        self.mode = mode
        self.active_connections: List[WebSocket] = []  # 이 방에 접속한 소켓들
        self.players: Dict[str, dict] = {} # user_id -> player_info (spectator 여부 등)
        self.game_logic = None  # TODO: SoloGameLogic() 등으로 초기화
        self.is_running = False
        self._task = None

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.players[user_id] = {"id": user_id, "is_spectator": False}
        print(f"[{self.room_code}] User {user_id} Connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.players:
            del self.players[user_id]
        print(f"[{self.room_code}] User {user_id} Disconnected.")

    async def broadcast(self, message: dict):
        """방에 있는 모든 사람에게 메시지 전송 (관전/플레이어 공통)"""
        if not self.active_connections:
            return
            
        json_msg = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(json_msg)
            except Exception:
                # 연결 끊긴 소켓은 추후 정리됨
                pass

    async def start_game_loop(self):
        """이 방만의 독립적인 게임 루프 시작 (30FPS)"""
        self.is_running = True
        self._task = asyncio.create_task(self._game_loop())

    async def _game_loop(self):
        print(f"[{self.room_code}] Game Loop Started.")
        try:
            while self.is_running:
                # 1. 게임 로직 업데이트 (예: 몬스터 이동, 타워 공격)
                # if self.game_logic:
                #     self.game_logic.update()
                #     state = self.game_logic.get_state()
                #     await self.broadcast({"type": "GAME_STATE", "data": state})

                # (임시) 테스트용 틱 전송
                # await self.broadcast({"type": "TICK", "timestamp": asyncio.get_event_loop().time()})

                await asyncio.sleep(0.033)  # 약 30 FPS
        except asyncio.CancelledError:
            print(f"[{self.room_code}] Game Loop Cancelled.")
        finally:
            print(f"[{self.room_code}] Game Loop Stopped.")

    def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()

class DiceRoomManager:
    """
    모든 주사위 게임 방을 관리하는 매니저 (Singleton)
    """
    def __init__(self):
        self._rooms: Dict[str, DiceGameRoom] = {}

    def create_room(self, mode: str = "solo") -> str:
        # 6자리 랜덤 대문자/숫자 코드 생성
        while True:
            chars = string.ascii_uppercase + string.digits
            code = ''.join(secrets.choice(chars) for _ in range(6))
            if code not in self._rooms:
                new_room = DiceGameRoom(code, mode)
                self._rooms[code] = new_room
                # 방 생성과 동시에 게임 루프 시작 (또는 플레이어 입장 시 시작하도록 변경 가능)
                asyncio.create_task(new_room.start_game_loop())
                print(f"=== Dice Room Created: {code} ===")
                return code

    def get_room(self, room_code: str) -> Optional[DiceGameRoom]:
        return self._rooms.get(room_code)

    def remove_room(self, room_code: str):
        if room_code in self._rooms:
            room = self._rooms[room_code]
            room.stop() # 루프 정지
            del self._rooms[room_code]
            print(f"=== Dice Room Deleted: {room_code} ===")

# 전역 인스턴스 (API에서 import해서 사용)
room_manager = DiceRoomManager()