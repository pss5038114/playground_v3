# app/main.py
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_rest_api import router as dice_router, active_games
from app.services.dice_defense.connection_manager import manager
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db

# -------------------------------------------------------------------------
# Global Game Loop (30Hz Ticker)
# -------------------------------------------------------------------------
async def game_loop():
    """
    서버 메모리에 존재하는 모든 활성 게임 세션(active_games)을 
    1초에 30번(30Hz) 업데이트하고 상태를 브로드캐스팅합니다.
    """
    while True:
        try:
            # 딕셔너리 크기가 루프 도중 변경될 수 있으므로 키를 리스트로 복사하여 순회
            game_ids = list(active_games.keys())
            
            for gid in game_ids:
                session = active_games.get(gid)
                if not session:
                    continue
                
                # 1. 게임 로직 업데이트 (SP 회복, 몹 이동, 충돌 처리 등)
                state_update = session.update()
                
                # 2. 변경된 상태가 있다면 해당 방의 클라이언트들에게 전송
                # (최적화를 위해 매 틱마다 보내지 않고, 중요 이벤트나 일정 간격마다 보낼 수도 있음)
                if state_update:
                    await manager.broadcast(gid, state_update)
                    
        except Exception as e:
            print(f"Error in global game loop: {e}")
            
        # 30Hz 유지를 위한 대기 (약 0.033초)
        await asyncio.sleep(1/30)

# -------------------------------------------------------------------------
# Lifespan Context Manager
# -------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # [Startup]
    print(">>> Server Starting... Initializing Database...")
    init_db() # DB 테이블 생성
    
    # 게임 루프 백그라운드 태스크 시작
    game_loop_task = asyncio.create_task(game_loop())
    print(">>> Global Game Loop Started (30Hz)")
    
    yield
    
    # [Shutdown]
    print(">>> Server Shutting down...")
    game_loop_task.cancel() # 루프 종료
    try:
        await game_loop_task
    except asyncio.CancelledError:
        pass
    print(">>> Game Loop Stopped.")

# -------------------------------------------------------------------------
# FastAPI App Setup
# -------------------------------------------------------------------------
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------------------
# REST API Routers
# -------------------------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(dice_router, prefix="/api/dice", tags=["Dice Defense"])
app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

# -------------------------------------------------------------------------
# WebSocket Endpoint
# -------------------------------------------------------------------------
@app.websocket("/ws/game/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """
    클라이언트가 게임 세션에 접속할 때 연결되는 웹소켓 엔드포인트.
    1. 연결 수락 및 ConnectionManager에 등록
    2. 초기 게임 상태 전송
    3. 클라이언트 입력(Spawn, Merge 등) 수신 및 처리
    4. 연결 종료 처리
    """
    # 게임 세션 존재 확인
    if game_id not in active_games:
        await websocket.close(code=4004, reason="Game session not found")
        return

    session = active_games[game_id]
    
    # 연결 수락
    await manager.connect(game_id, websocket)
    
    try:
        # 접속 성공 시 초기 전체 상태(INIT) 전송
        await websocket.send_json(session.get_initial_state())
        
        # 클라이언트 메시지 수신 루프
        while True:
            data = await websocket.receive_json()
            
            # 입력 처리 (게임 세션 내부 로직 호출)
            session.process_command(data)
            
            # 참고: 상태 업데이트는 game_loop에서 주기적으로 브로드캐스트되므로
            # 여기서는 입력을 처리하고 상태값만 변경해두면 됩니다.
            
    except WebSocketDisconnect:
        print(f"Client disconnected from game {game_id}")
        manager.disconnect(game_id, websocket)
        # 플레이어가 나갔을 때의 로직 (게임 일시정지, 패배 처리 등) 추가 가능
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(game_id, websocket)

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is running!"}