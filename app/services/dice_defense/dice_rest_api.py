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

# [NEW] 덱 정보 조회
@router.get("/deck/{username}")
async def get_my_deck(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id, deck FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        # 덱 파싱 (콤마 구분 문자열 -> 리스트)
        deck_ids = user["deck"].split(",") if user["deck"] else ["none"]*5
        
        # 덱에 장착된 주사위들의 상세 정보 조회 (레벨 등)
        deck_data = []
        for did in deck_ids:
            if did == "none" or did not in DICE_DATA:
                deck_data.append(None) # 빈 슬롯
            else:
                # 보유 정보 조회
                row = conn.execute("SELECT class_level FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], did)).fetchone()
                level = row["class_level"] if row else 0
                
                info = DICE_DATA[did]
                deck_data.append({
                    "id": did,
                    "name": info["name"],
                    "rarity": info["rarity"],
                    "color": info["color"],
                    "symbol": info.get("symbol", "ri-dice-fill"),
                    "class_level": level
                })
        
        return {"deck": deck_data}
    finally:
        conn.close()

# [NEW] 덱 저장
@router.post("/deck")
async def save_my_deck(payload: dict = Body(...)):
    username = payload.get("username")
    deck_ids = payload.get("deck") # List[str] 예: ["fire", "wind", "none", "none", "none"]
    
    if not deck_ids or len(deck_ids) != 5:
        raise HTTPException(400, "잘못된 덱 데이터입니다.")

    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        # 실제로 유저가 보유한 주사위인지 검증 (none 제외)
        for did in deck_ids:
            if did != "none":
                owned = conn.execute("SELECT 1 FROM user_dice WHERE user_id = ? AND dice_id = ? AND class_level > 0", (user["id"], did)).fetchone()
                if not owned:
                    raise HTTPException(400, f"미보유 주사위 포함: {did}")
        
        deck_str = ",".join(deck_ids)
        conn.execute("UPDATE users SET deck = ? WHERE id = ?", (deck_str, user["id"]))
        conn.commit()
        
        return {"message": "Deck saved"}
    finally:
        conn.close()