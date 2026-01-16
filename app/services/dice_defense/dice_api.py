# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.services.dice_defense.room_manager import room_manager
from app.core.auth_logic import get_current_user_from_token

router = APIRouter()

@router.post("/create_room")
async def create_room(mode: str = "solo"):
    """
    게임 시작 버튼 -> 방 생성 -> 방 코드 반환
    """
    room_code = room_manager.create_room(mode)
    return {"room_code": room_code}

@router.websocket("/ws/dice/{room_code}")
async def dice_game_websocket(websocket: WebSocket, room_code: str):
    """
    게임/관전 접속 (방 코드 필수)
    """
    room = room_manager.get_room(room_code)
    if not room:
        await websocket.close(code=4000, reason="Invalid Room Code")
        return

    # 토큰 검증 (선택사항)
    token = websocket.query_params.get("token")
    user_id = "guest"
    if token:
        user = await get_current_user_from_token(token)
        if user:
            user_id = user["id"]
    
    # 방 입장 (Connection)
    await room.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            
            # 클라이언트 메시지 처리 (예: 스폰, 머지 등)
            if data.get("type") == "SPAWN":
                # 추후 구현: room.game_logic.spawn_dice(user_id)
                await room.broadcast({"type": "NOTICE", "msg": f"{user_id} spawned dice!"})

    except WebSocketDisconnect:
        room.disconnect(websocket, user_id)
        # 방에 사람이 없으면 삭제 (정책에 따라 조정 가능)
        if not room.active_connections:
            room_manager.remove_room(room_code)