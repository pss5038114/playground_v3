# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.session_manager import session_manager
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.websocket("/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    try:
        # 세션 가져오기 (에러 발생 가능 지점)
        session = session_manager.get_or_create_session(session_id)
        
        # 플레이어 추가 (여기서 accept() 호출됨)
        await session.add_player(websocket)
        
        # 메시지 루프
        while True:
            data = await websocket.receive_json()
            await session.handle_command(data)
            
    except WebSocketDisconnect:
        session = session_manager.active_sessions.get(session_id)
        if session:
            session.remove_player(websocket)
            
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        # 연결이 수립되지 않은 상태라면 닫아줌
        try:
            await websocket.close(code=1011) # 1011: Server Error
        except:
            pass