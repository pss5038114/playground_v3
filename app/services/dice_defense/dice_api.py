from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.session_manager import session_manager

router = APIRouter()

@router.websocket("/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        session.remove_player(websocket)