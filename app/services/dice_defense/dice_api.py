# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.session_manager import session_manager

router = APIRouter()

@router.websocket("/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            # [변경] 메시지를 세션 로직으로 전달
            await session.handle_command(data)
    except WebSocketDisconnect:
        session.remove_player(websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        session.remove_player(websocket)