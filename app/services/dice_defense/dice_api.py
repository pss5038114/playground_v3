from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from app.services.auth.auth_api import get_current_user_token
from app.services.dice_defense.game_session import GameSession

# [중요] SessionManager는 싱글톤이어야 합니다.
# app.core.session_manager에 'session_manager' 인스턴스가 있다고 가정하거나,
# 여기서 직접 임포트해서 사용해야 합니다. 
# 만약 파일에 인스턴스가 없다면 아래와 같이 클래스를 임포트하고 전역 인스턴스를 만듭니다.
from app.core.session_manager import SessionManager 

router = APIRouter()

# 전역 세션 매니저 (GlobalTicker와 공유되어야 함)
# 주의: 실제 프로젝트에서는 app/core/session_manager.py 안에 
# `session_manager = SessionManager()`를 선언하고 그걸 import해서 쓰는 것이 가장 좋습니다.
try:
    from app.core.session_manager import session_manager
except ImportError:
    # 폴백: 인스턴스가 없다면 여기서 생성 (주의: Ticker도 이 인스턴스를 써야 함)
    session_manager = SessionManager()

class GameStartRequest(BaseModel):
    mode: str = "single"

class GameActionRequest(BaseModel):
    session_id: str
    action_type: str
    payload: dict = {}

@router.post("/start")
async def start_game(req: GameStartRequest, user: dict = Depends(get_current_user_token)):
    user_id = user['user_id']
    
    # 새 세션 생성
    session_id = str(uuid.uuid4())
    new_session = GameSession(session_id, [user_id], req.mode)
    
    # 매니저에 등록
    session_manager.create_session(session_id, new_session)
    
    return {
        "status": "success",
        "session_id": session_id,
        "mode": req.mode
    }

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