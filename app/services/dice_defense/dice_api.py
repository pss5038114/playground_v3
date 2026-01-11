from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

# 추후 구현된 모듈 import
# from app.core.session_manager import session_manager 
# from .core import DiceGameSession

router = APIRouter()

class GameStartRequest(BaseModel):
    user_id: str
    mode: str = "single" # single, pvp, co-op

class GameResponse(BaseModel):
    session_id: str
    status: str
    message: str

# 임시 세션 저장소 (추후 session_manager와 통합)
active_games = {}

@router.post("/start", response_model=GameResponse)
async def start_game(req: GameStartRequest):
    """
    게임을 시작하고 세션을 생성합니다.
    """
    # TODO: 유저 검증 로직 추가
    
    session_id = f"sess_{req.user_id}_{req.mode}"
    
    # 게임 세션 초기화 (Mock)
    active_games[session_id] = {
        "user_id": req.user_id,
        "sp": 100,
        "wave": 1,
        "grid": [None] * 15  # 15칸 빈 그리드
    }
    
    return GameResponse(
        session_id=session_id,
        status="active",
        message="Game started successfully"
    )

@router.post("/quit")
async def quit_game(session_id: str):
    if session_id in active_games:
        del active_games[session_id]
        return {"status": "success", "message": "Game session closed"}
    return {"status": "error", "message": "Session not found"}