# app/services/dice_defense/dice_rest_api.py
from fastapi import APIRouter, HTTPException, Body
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER
import random

router = APIRouter()

# 가챠 확률 설정
RARITY_WEIGHTS = [
    ("Common", 0.55),
    ("Rare", 0.28),
    ("Hero", 0.14),
    ("Legend", 0.03)
]

def pick_one_dice():
    """확률에 따라 주사위 하나를 랜덤하게 선택합니다."""
    # 1. 등급 결정
    r = random.random()
    cumulative = 0.0
    selected_rarity = "Common"
    for rarity, weight in RARITY_WEIGHTS:
        cumulative += weight
        if r <= cumulative:
            selected_rarity = rarity
            break
    
    # 2. 해당 등급 내 주사위 선택
    candidates = [did for did, info in DICE_DATA.items() if info["rarity"] == selected_rarity]
    if not candidates: # Fallback
        candidates = list(DICE_DATA.keys())
    
    return random.choice(candidates)

@router.get("/list/{username}")
async def get_my_dice_list(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(status_code=404, detail="User not found")
        user_id = user["id"]

        rows = conn.execute("SELECT dice_id, class_level, quantity FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        owned_map = {row["dice_id"]: dict(row) for row in rows}

        result = []
        updates_needed = []

        for dice_id, info in DICE_DATA.items():
            dice_data = {
                "id": dice_id,
                "name": info["name"],
                "rarity": info["rarity"],
                "color": info["color"],
                "desc": info["desc"],
                "stats": info.get("stats", {}), # [추가] 스탯 데이터 포함
                "class_level": 0,
                "quantity": 0
            }

            if dice_id in owned_map:
                dice_data["class_level"] = owned_map[dice_id]["class_level"]
                dice_data["quantity"] = owned_map[dice_id]["quantity"]
            else:
                if info["rarity"] == "Common":
                    dice_data["class_level"] = 1
                    updates_needed.append((user_id, dice_id, 1, 0))

            result.append(dice_data)

        if updates_needed:
            conn.executemany("INSERT INTO user_dice (user_id, dice_id, class_level, quantity) VALUES (?, ?, ?, ?)", updates_needed)
            conn.commit()

        result.sort(key=lambda x: (RARITY_ORDER.get(x["rarity"], 0), x["id"]), reverse=True)
        return result
    finally:
        conn.close()

@router.post("/summon")
async def summon_dice(payload: dict = Body(...)):
    username = payload.get("username")
    count = payload.get("count", 1) # 1 or 10
    
    conn = get_db_connection()
    try:
        # 1. 유저 및 티켓 확인
        user = conn.execute("SELECT id, tickets FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        ticket_cost = 1 if count == 1 else 10
        if user["tickets"] < ticket_cost:
             raise HTTPException(400, "티켓이 부족합니다.")
             
        # 2. 티켓 소모
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE id = ?", (ticket_cost, user["id"]))
        
        # 3. 가챠 실행 (10회 소환 시 11개 지급)
        real_count = 11 if count == 10 else 1
        results = [pick_one_dice() for _ in range(real_count)]
        
        # 4. 결과 집계 및 DB 반영 (UPSERT 로직 구현)
        result_summary = {} 
        for did in results:
            result_summary[did] = result_summary.get(did, 0) + 1
            
        for did, qty in result_summary.items():
            # 기존 레코드 확인
            row = conn.execute("SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], did)).fetchone()
            if row:
                conn.execute("UPDATE user_dice SET quantity = quantity + ? WHERE id = ?", (qty, row["id"]))
            else:
                conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, ?, 0)", (user["id"], did, qty))
                
        conn.commit()
        
        # 결과 반환 (연출용 데이터)
        return {
            "results": [{"id": did, "name": DICE_DATA[did]["name"], "rarity": DICE_DATA[did]["rarity"]} for did in results],
            "remaining_tickets": user["tickets"] - ticket_cost
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

@router.post("/upgrade")
async def upgrade_dice(payload: dict = Body(...)):
    username = payload.get("username")
    dice_id = payload.get("dice_id")
    
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id, gold FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        dice_row = conn.execute("SELECT * FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], dice_id)).fetchone()
        if not dice_row: raise HTTPException(400, "주사위 정보를 찾을 수 없습니다.")
        
        current_level = dice_row["class_level"]
        quantity = dice_row["quantity"]
        
        # 비용 계산
        req_cards = 0
        req_gold = 0
        
        if current_level == 0:
            # 해금 (Unlock)
            req_cards = 1
            req_gold = 0
        else:
            # 강화 (Upgrade)
            req_cards = 5
            req_gold = current_level * 1000 # 예: 1레벨->2레벨 비용 1000골드
            
        if quantity < req_cards:
            raise HTTPException(400, "카드가 부족합니다.")
        if user["gold"] < req_gold:
             raise HTTPException(400, "골드가 부족합니다.")
             
        # 실행
        conn.execute("UPDATE user_dice SET quantity = quantity - ?, class_level = class_level + 1 WHERE id = ?", (req_cards, dice_row["id"]))
        conn.execute("UPDATE users SET gold = gold - ? WHERE id = ?", (req_gold, user["id"]))
        conn.commit()
        
        return {"message": "Success", "new_level": current_level + 1}
        
    finally:
        conn.close()