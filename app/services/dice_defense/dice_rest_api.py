# app/services/dice_defense/dice_rest_api.py
from fastapi import APIRouter, HTTPException, Body
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER, UPGRADE_RULES
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
    r = random.random()
    cumulative = 0.0
    selected_rarity = "Common"
    for rarity, weight in RARITY_WEIGHTS:
        cumulative += weight
        if r <= cumulative:
            selected_rarity = rarity
            break
    
    candidates = [did for did, info in DICE_DATA.items() if info["rarity"] == selected_rarity]
    if not candidates: 
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
                "symbol": info.get("symbol", "ri-dice-fill"),
                "desc": info["desc"],
                "stats": info.get("stats", {}),
                "class_level": 0,
                "quantity": 0,
                "next_cost": None
            }

            if dice_id in owned_map:
                dice_data["class_level"] = owned_map[dice_id]["class_level"]
                dice_data["quantity"] = owned_map[dice_id]["quantity"]
            else:
                if info["rarity"] == "Common":
                    dice_data["class_level"] = 1
                    updates_needed.append((user_id, dice_id, 1, 0))

            # 다음 레벨업 비용 계산
            curr_lv = dice_data["class_level"]
            if curr_lv < 20: 
                rarity = info["rarity"]
                req_gold = UPGRADE_RULES["gold"][curr_lv]
                req_cards = UPGRADE_RULES["cards"][rarity][curr_lv]
                
                dice_data["next_cost"] = {
                    "gold": req_gold,
                    "cards": req_cards
                }

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
    count = payload.get("count", 1) 
    
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id, tickets FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        ticket_cost = 1 if count == 1 else 10
        if user["tickets"] < ticket_cost:
             raise HTTPException(400, "티켓이 부족합니다.")
             
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE id = ?", (ticket_cost, user["id"]))
        
        real_count = 11 if count == 10 else 1
        results_ids = [pick_one_dice() for _ in range(real_count)]
        
        result_summary = {} 
        for did in results_ids:
            result_summary[did] = result_summary.get(did, 0) + 1
            
        for did, qty in result_summary.items():
            row = conn.execute("SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], did)).fetchone()
            if row:
                conn.execute("UPDATE user_dice SET quantity = quantity + ? WHERE id = ?", (qty, row["id"]))
            else:
                conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, ?, 0)", (user["id"], did, qty))
                
        conn.commit()
        
        # [수정] 반환 데이터에 상세 정보 포함 (color, symbol 등)
        response_results = []
        for did in results_ids:
            info = DICE_DATA[did]
            response_results.append({
                "id": did,
                "name": info["name"],
                "rarity": info["rarity"],
                "color": info["color"], # 중요: 이것 때문에 에러가 났음
                "symbol": info.get("symbol", "ri-dice-fill"),
                "desc": info["desc"]
            })

        return {
            "results": response_results,
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
        
        if current_level >= 20:
            raise HTTPException(400, "이미 최대 레벨입니다.")
        
        dice_info = DICE_DATA.get(dice_id)
        if not dice_info: raise HTTPException(400, "잘못된 주사위 ID")
        
        rarity = dice_info["rarity"]
        req_gold = UPGRADE_RULES["gold"][current_level]
        req_cards = UPGRADE_RULES["cards"][rarity][current_level]
            
        if quantity < req_cards:
            raise HTTPException(400, "카드가 부족합니다.")
        if user["gold"] < req_gold:
             raise HTTPException(400, "골드가 부족합니다.")
             
        conn.execute("UPDATE user_dice SET quantity = quantity - ?, class_level = class_level + 1 WHERE id = ?", (req_cards, dice_row["id"]))
        conn.execute("UPDATE users SET gold = gold - ? WHERE id = ?", (req_gold, user["id"]))
        conn.commit()
        
        return {"message": "Success", "new_level": current_level + 1}
        
    finally:
        conn.close()

# [NEW] 덱 정보 불러오기
@router.get("/deck/{username}")
async def get_my_deck(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        # 덱 정보 조회
        row = conn.execute("SELECT * FROM user_decks WHERE user_id = ?", (user["id"],)).fetchone()
        
        if row:
            # 저장된 덱 반환
            return {
                "deck": [row["slot_1"], row["slot_2"], row["slot_3"], row["slot_4"], row["slot_5"]]
            }
        else:
            # 덱 정보가 없으면 기본 덱 생성 및 저장
            default_deck = ['fire', 'electric', 'wind', 'ice', 'poison']
            conn.execute("""
                INSERT INTO user_decks (user_id, slot_1, slot_2, slot_3, slot_4, slot_5) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user["id"], *default_deck))
            conn.commit()
            
            return {"deck": default_deck}
            
    finally:
        conn.close()

# [NEW] 덱 정보 저장하기
@router.post("/deck/save")
async def save_my_deck(payload: dict = Body(...)):
    username = payload.get("username")
    deck = payload.get("deck") # ["id1", "id2", ...]
    
    if not deck or len(deck) != 5:
        raise HTTPException(400, "Invalid deck format")
        
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        # 덱 업데이트 (없으면 INSERT, 있으면 UPDATE - REPLACE 구문 사용)
        conn.execute("""
            REPLACE INTO user_decks (user_id, slot_1, slot_2, slot_3, slot_4, slot_5)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user["id"], *deck))
        conn.commit()
        
        return {"message": "Deck saved"}
    finally:
        conn.close()