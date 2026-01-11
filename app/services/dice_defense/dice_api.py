# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.core.session_manager import session_manager
from app.core.database import get_db_connection
from app.services.dice_defense.dice_logic import execute_gacha
# [수정] dice 폴더 안의 dice_data를 바라보도록 경로 변경
from app.services.dice_defense.dice.dice_data import DICE_DATA
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class GachaRequest(BaseModel):
    username: str
    draw_count: int

class UpgradeRequest(BaseModel):
    username: str
    dice_id: str

# --- [HTTP API] 가챠 및 인벤토리 시스템 ---

@router.post("/gacha")
async def pull_gacha(req: GachaRequest):
    if req.draw_count not in [1, 10]:
        raise HTTPException(status_code=400, detail="1회 또는 10회 뽑기만 가능합니다.")

    cost = 1 * req.draw_count 
    
    conn = get_db_connection()
    try:
        # 1. 티켓 확인 및 차감
        user = conn.execute("SELECT tickets FROM users WHERE username = ?", (req.username,)).fetchone()
        if not user: raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
        if user['tickets'] < cost: raise HTTPException(status_code=400, detail="티켓이 부족합니다.")
            
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE username = ?", (cost, req.username))
        
        # 2. 가챠 실행
        acquired_dice_ids = execute_gacha(req.draw_count)
        
        # 3. 결과 DB 저장
        for dice_id in acquired_dice_ids:
            row = conn.execute("SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", (req.username, dice_id)).fetchone()
            if row:
                conn.execute("UPDATE user_dice SET card_count = card_count + 1 WHERE id = ?", (row['id'],))
            else:
                conn.execute("INSERT INTO user_dice (user_id, dice_id, class_level, card_count) VALUES (?, ?, 0, 1)", (req.username, dice_id))
        
        conn.commit()
        
        result_details = []
        for did in acquired_dice_ids:
            info = DICE_DATA.get(did, {})
            result_details.append({"id": did, "name": info.get("name", "Unknown"), "rarity": info.get("rarity", "Common")})
            
        return {"message": "가챠 성공", "results": result_details, "remaining_tickets": user['tickets'] - cost}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# [신규] 인벤토리(덱) 정보 조회
@router.get("/list/{username}")
async def get_dice_inventory(username: str):
    conn = get_db_connection()
    try:
        # 1. DB에 저장된 유저 데이터 조회 (소유했거나 카드가 있는 주사위)
        rows = conn.execute("SELECT dice_id, class_level, card_count FROM user_dice WHERE user_id = ?", (username,)).fetchall()
        user_dice_map = {row['dice_id']: dict(row) for row in rows}
        
        inventory = []
        
        # 2. 정적 데이터(DICE_DATA)를 기준으로 전체 목록 생성
        for dice_id, info in DICE_DATA.items():
            user_data = user_dice_map.get(dice_id, {"class_level": 0, "card_count": 0})
            
            level = user_data["class_level"]
            card_count = user_data["card_count"]
            
            # 업그레이드/해금 조건 계산
            req_card = 1 if level == 0 else 5
            req_gold = 0 if level == 0 else level * 500
            
            can_upgrade = card_count >= req_card
            
            inventory.append({
                "id": dice_id,
                "name": info["name"],
                "rarity": info["rarity"],
                "desc": info["desc"],
                "level": level,
                "card_count": card_count,
                "req_card": req_card,
                "req_gold": req_gold,
                "can_upgrade": can_upgrade,
                "is_owned": level > 0
            })
            
        # 3. 정렬: 보유 여부 -> 등급 -> 레벨 -> 이름
        rarity_rank = {"Legend": 4, "Hero": 3, "Rare": 2, "Common": 1}
        inventory.sort(key=lambda x: (x["is_owned"], rarity_rank.get(x["rarity"], 0), x["level"], x["name"]), reverse=True)
        
        return inventory
    finally:
        conn.close()

# [신규] 주사위 강화/해금
@router.post("/upgrade")
async def upgrade_dice(req: UpgradeRequest):
    conn = get_db_connection()
    try:
        # 1. 유저 재화 및 주사위 정보 조회
        user = conn.execute("SELECT gold FROM users WHERE username = ?", (req.username,)).fetchone()
        dice_row = conn.execute("SELECT id, class_level, card_count FROM user_dice WHERE user_id = ? AND dice_id = ?", (req.username, req.dice_id)).fetchone()
        
        if not user: raise HTTPException(status_code=404, detail="유저 정보 없음")
        if not dice_row: raise HTTPException(status_code=400, detail="해당 주사위 카드를 보유하고 있지 않습니다.")
        
        level = dice_row["class_level"]
        card_count = dice_row["card_count"]
        
        # 2. 비용 계산
        req_card = 1 if level == 0 else 5
        req_gold = 0 if level == 0 else level * 500
        
        # 3. 조건 확인
        if card_count < req_card:
            raise HTTPException(status_code=400, detail=f"카드가 부족합니다. (필요: {req_card})")
        if user["gold"] < req_gold:
            raise HTTPException(status_code=400, detail=f"골드가 부족합니다. (필요: {req_gold})")
        
        # 4. 차감 및 업데이트 수행
        if req_gold > 0:
            conn.execute("UPDATE users SET gold = gold - ? WHERE username = ?", (req_gold, req.username))
        
        new_level = level + 1
        new_card_count = card_count - req_card
        conn.execute("UPDATE user_dice SET class_level = ?, card_count = ? WHERE id = ?", (new_level, new_card_count, dice_row["id"]))
        
        conn.commit()
        
        msg = "해금 완료!" if level == 0 else f"Lv.{new_level} 강화 성공!"
        return {"message": msg, "new_level": new_level, "remaining_gold": user["gold"] - req_gold}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- [WebSocket] 게임 세션 ---
@router.websocket("/ws/game/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        session.remove_player(websocket)