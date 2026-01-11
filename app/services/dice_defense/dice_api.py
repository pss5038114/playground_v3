#
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import random
from app.core.database import get_db_connection
from app.services.auth.auth_api import get_current_user_token
from .dice_data import DICE_BOOK, RARITY_CONFIG

router = APIRouter()

# --- API 모델 ---
class UpgradeRequest(BaseModel):
    dice_id: str

# --- 로직 함수 ---
def get_random_dice_by_rarity():
    r = random.random()
    accum = 0
    selected_rarity = "Common"
    for rarity, config in RARITY_CONFIG.items():
        accum += config["prob"]
        if r <= accum:
            selected_rarity = rarity
            break
    
    # 해당 등급의 주사위들 중 하나 랜덤 선택
    possible_dice = [k for k, v in DICE_BOOK.items() if v["rarity"] == selected_rarity]
    return random.choice(possible_dice) if possible_dice else "fire"

# --- Endpoints ---

@router.get("/inventory")
async def get_inventory(user: dict = Depends(get_current_user_token)):
    username = user['username']
    conn = get_db_connection()
    
    # 티켓 확인
    asset = conn.execute("SELECT tickets FROM user_assets WHERE username = ?", (username,)).fetchone()
    tickets = asset["tickets"] if asset else 0
    
    # 보유 주사위 정보
    rows = conn.execute("SELECT dice_id, card_count, class_level FROM user_dice WHERE username = ?", (username,)).fetchall()
    owned_data = {row["dice_id"]: {"cards": row["card_count"], "level": row["class_level"]} for row in rows}
    
    conn.close()
    return {"tickets": tickets, "inventory": owned_data, "dice_book": DICE_BOOK}

@router.post("/gacha")
async def open_box(count: int, user: dict = Depends(get_current_user_token)):
    username = user['username']
    ticket_cost = 1 if count == 1 else 10
    actual_draw = 1 if count == 1 else 11
    
    conn = get_db_connection()
    asset = conn.execute("SELECT tickets FROM user_assets WHERE username = ?", (username,)).fetchone()
    
    if not asset or asset["tickets"] < ticket_cost:
        conn.close()
        raise HTTPException(status_code=400, detail="티켓이 부족합니다.")
    
    # 티켓 차감
    conn.execute("UPDATE user_assets SET tickets = tickets - ? WHERE username = ?", (ticket_cost, username))
    
    results = []
    for _ in range(actual_draw):
        dice_id = get_random_dice_by_rarity()
        results.append(dice_id)
        # 카드 수량 업데이트
        conn.execute("""
            INSERT INTO user_dice (username, dice_id, card_count, class_level)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(username, dice_id) DO UPDATE SET card_count = card_count + 1
        """, (username, dice_id))
    
    conn.commit()
    conn.close()
    return {"results": results, "new_tickets": asset["tickets"] - ticket_cost}

@router.post("/add-test-tickets")
async def add_tickets(user: dict = Depends(get_current_user_token)):
    username = user['username']
    conn = get_db_connection()
    conn.execute("INSERT INTO user_assets (username, tickets) VALUES (?, 10) ON CONFLICT(username) DO UPDATE SET tickets = tickets + 10", (username,))
    conn.commit()
    conn.close()
    return {"message": "티켓 10개가 추가되었습니다."}

@router.post("/upgrade")
async def upgrade_dice(req: UpgradeRequest, user: dict = Depends(get_current_user_token)):
    username = user['username']
    conn = get_db_connection()
    row = conn.execute("SELECT card_count, class_level FROM user_dice WHERE username = ? AND dice_id = ?", (username, req.dice_id)).fetchone()
    
    if not row or row["card_count"] < 5: # 테스트용 고정 5개
        conn.close()
        raise HTTPException(status_code=400, detail="카드가 부족합니다.")
    
    if row["class_level"] >= 20:
        conn.close()
        raise HTTPException(status_code=400, detail="최대 클래스입니다.")

    conn.execute("UPDATE user_dice SET card_count = card_count - 5, class_level = class_level + 1 WHERE username = ? AND dice_id = ?", (username, req.dice_id))
    conn.commit()
    conn.close()
    return {"status": "success"}

@router.post("/acquire")
async def acquire_dice(req: UpgradeRequest, user: dict = Depends(get_current_user_token)):
    username = user['username']
    conn = get_db_connection()
    conn.execute("UPDATE user_dice SET class_level = 1 WHERE username = ? AND dice_id = ? AND class_level = 0", (username, req.dice_id))
    conn.commit()
    conn.close()
    return {"status": "success"}