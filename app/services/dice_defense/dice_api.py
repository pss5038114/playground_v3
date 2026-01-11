from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

# 수정된 SessionManager 인스턴스를 가져옵니다.
from app.core.session_manager import session_manager
from app.services.auth.auth_api import get_current_user_token
from app.services.dice_defense.game_session import GameSession

router = APIRouter()

class GameStartRequest(BaseModel):
    mode: str = "single"

class GameActionRequest(BaseModel):
    session_id: str
    action_type: str
    payload: dict = {}

@router.post("/start")
async def start_game(req: GameStartRequest, user: dict = Depends(get_current_user_token)):
    user_id = user['user_id']
    session_id = str(uuid.uuid4())
    # 전용 GameSession 객체 생성
    new_session = GameSession(session_id, [user_id], req.mode)
    # 매니저에 등록
    session_manager.create_session(session_id, new_session)
    return {"status": "success", "session_id": session_id, "mode": req.mode}

@router.post("/action")
async def game_action(req: GameActionRequest, user: dict = Depends(get_current_user_token)):
    session = session_manager.get_session(req.session_id)
    if not session: 
        raise HTTPException(status_code=404, detail="Session not found")
    session.handle_input(user['user_id'], {"type": req.action_type, **req.payload})
    return {"status": "queued"}

@router.post("/leave")
async def leave_game(req: GameActionRequest, user: dict = Depends(get_current_user_token)):
    session_manager.remove_session(req.session_id)
    return {"status": "left"}