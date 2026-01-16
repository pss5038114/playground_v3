from typing import Dict, List, Any
from fastapi import WebSocket

# [NEW] 게임 로직 임포트
from app.services.dice_defense.modes.solo.game import SoloGameLogic

class GameSession:
    def __init__(self, session_id: str):
        self.session_id = session_id
        # 웹소켓 연결 관리
        self.active_connections: List[WebSocket] = []
        
        # [NEW] 게임 로직 인스턴스 (State Container)
        # 추후 모드에 따라 Factory 패턴으로 분기 가능 (ex: if mode == 'pvp': PvPGameLogic())
        self.game_logic = SoloGameLogic()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # [NEW] 접속 시 현재 게임 상태(State)를 즉시 전송 (Sync)
        initial_state = self.game_logic.get_state()
        await websocket.send_json(initial_state)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # 연결된 모든 클라이언트에게 메시지 전송
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # 연결이 끊긴 소켓 처리 (필요 시 목록에서 제거 로직 추가)
                pass

    async def update(self):
        """
        GlobalTicker에 의해 주기적으로 호출됨.
        """
        # [NEW] 게임 로직의 틱 업데이트 실행
        self.game_logic.update()
        
        # (옵션) 몬스터 위치 등 실시간 변경사항이 있을 때만 broadcast 할 수도 있음
        # await self.broadcast({"type": "TICK", ...})

    async def process_command(self, data: dict, user_id: str):
        """
        클라이언트에서 보낸 메시지 처리
        """
        cmd_type = data.get("type")

        # [NEW] SPAWN 명령어 처리
        if cmd_type == "SPAWN":
            result = self.game_logic.spawn_dice(user_id)
            if result:
                # 결과(성공/실패/그리드갱신)를 방에 있는 모두에게 전송
                await self.broadcast(result)

        # 다른 명령어들...
        elif cmd_type == "MERGE":
            pass # TODO: 구현 예정


class SessionManager:
    """
    여러 개의 GameSession을 관리하는 싱글톤 관리자
    """
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}

    async def connect_player(self, session_id: str, websocket: WebSocket):
        if session_id not in self.active_sessions:
            # 방이 없으면 생성
            self.active_sessions[session_id] = GameSession(session_id)
        
        session = self.active_sessions[session_id]
        await session.connect(websocket)

    def disconnect_player(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.disconnect(websocket)
            
            # 방에 아무도 없으면 방 폭파 (메모리 관리)
            if not session.active_connections:
                del self.active_sessions[session_id]

    async def handle_command(self, session_id: str, data: dict, user_id: str):
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            await session.process_command(data, user_id)

    async def update_all_sessions(self):
        # 모든 활성화된 세션의 update() 호출
        for session in self.active_sessions.values():
            await session.update()

# 전역 인스턴스
session_manager = SessionManager()