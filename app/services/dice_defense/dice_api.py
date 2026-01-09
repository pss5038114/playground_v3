from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.session_manager import session_manager
import json

router = APIRouter()

@router.websocket("/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    
    try:
        while True:
            # 비동기로 메시지 수신
            data = await websocket.receive_json()
            # 세션 큐에 입력 전달 (즉시 처리하지 않음)
            session.handle_input(data)
            
    except WebSocketDisconnect:
        session.remove_player(websocket)
        # 플레이어가 0명이면 세션 정리 (옵션)
        if not session.players:
            session_manager.remove_session(session_id)
    except Exception as e:
        print(f"WS Error: {e}")
        session.remove_player(websocket)