# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Body
from app.core.session_manager import session_manager
from app.core.database import get_db_connection
from app.services.dice_defense.dice_logic import execute_gacha
from app.services.dice_defense.dice_data import DICE_DATA
from pydantic import BaseModel

router = APIRouter()

class GachaRequest(BaseModel):
    username: str
    draw_count: int  # 1 or 10

# --- [HTTP API] 가챠 시스템 ---

@router.post("/gacha")
async def pull_gacha(req: GachaRequest):
    if req.draw_count not in [1, 10]:
        raise HTTPException(status_code=400, detail="1회 또는 10회 뽑기만 가능합니다.")

    cost = 1 * req.draw_count # 티켓 1장당 1회 (10회 시 10장 소모하고 11번 뽑음)
    
    conn = get_db_connection()
    try:
        # 1. 티켓 확인 및 차감
        user = conn.execute("SELECT tickets FROM users WHERE username = ?", (req.username,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
        
        if user['tickets'] < cost:
            raise HTTPException(status_code=400, detail="티켓이 부족합니다.")
            
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE username = ?", (cost, req.username))
        
        # 2. 가챠 실행 (로직 분리)
        acquired_dice_ids = execute_gacha(req.draw_count)
        
        # 3. 결과 DB 저장 (카드 적립 방식)
        # - user_dice 테이블에 row가 없으면 생성(class_level=0), 있으면 card_count만 증가
        for dice_id in acquired_dice_ids:
            # 존재 여부 확인
            row = conn.execute(
                "SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", 
                (req.username, dice_id)
            ).fetchone()
            
            if row:
                # 이미 존재하면 카드 수 추가
                conn.execute(
                    "UPDATE user_dice SET card_count = card_count + 1 WHERE id = ?", 
                    (row['id'],)
                )
            else:
                # 없으면 신규 생성 (class_level=0: 미해금 상태, card_count=1)
                conn.execute(
                    "INSERT INTO user_dice (user_id, dice_id, class_level, card_count) VALUES (?, ?, 0, 1)",
                    (req.username, dice_id)
                )
        
        conn.commit()
        
        # 4. 결과 반환 (프론트엔드 연출용 데이터)
        # 단순히 ID만 주는게 아니라, 이름과 등급 정보도 같이 줘서 연출하기 편하게 함
        result_details = []
        for did in acquired_dice_ids:
            info = DICE_DATA.get(did, {})
            result_details.append({
                "id": did,
                "name": info.get("name", "Unknown"),
                "rarity": info.get("rarity", "Common")
            })
            
        return {
            "message": "가챠 성공",
            "results": result_details,
            "remaining_tickets": user['tickets'] - cost
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- [WebSocket] 게임 세션 (기존 유지) ---
@router.websocket("/ws/game/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        session.remove_player(websocket)