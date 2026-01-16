from fastapi import APIRouter, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER, UPGRADE_RULES
import random
import math

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

def calculate_crit_damage_for_dice(class_level: int) -> int:
    """
    주사위 하나가 기여하는 크리티컬 데미지 계산
    공식: 1, 1, 2, 2, 3, 3, 4... 순서로 누적
    """
    if class_level < 1:
        return 0
    
    total = 0
    for i in range(1, class_level + 1):
        total += math.ceil(i / 2)
    return total

# -------------------------------------------------------------------------
# [NEW] 전투 로딩 시 사용: 현재 장착된 덱(Preset 1) 가져오기
# -------------------------------------------------------------------------
@router.get("/deck/active")
async def get_active_deck(request: Request):
    """
    게임 시작 시 로딩 화면에서 호출됩니다.
    현재 유저가 선택한(혹은 1번) 프리셋의 주사위 정보를 반환합니다.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    
    conn = get_db_connection()
    try:
        # 1. 유저의 Active 덱 인덱스를 가져와야 하지만, 
        #    지금은 요청하신 대로 'Preset 1'을 기본으로 사용합니다.
        #    (추후 users 테이블에 active_deck_index 컬럼이 있다면 그걸 조회하도록 수정 가능)
        target_preset = 1 

        # 2. user_decks 테이블에서 조회
        row = conn.execute("""
            SELECT slot_1, slot_2, slot_3, slot_4, slot_5 
            FROM user_decks 
            WHERE user_id = ? AND preset_index = ?
        """, (user_id, target_preset)).fetchone()
        
        # 3. DB에 덱 정보가 없으면 기본 덱(불,전기,바람,얼음,독) 사용
        if not row:
            slots = ['fire', 'electric', 'wind', 'ice', 'poison']
        else:
            slots = [row["slot_1"], row["slot_2"], row["slot_3"], row["slot_4"], row["slot_5"]]
            
        # 4. 클라이언트가 렌더링하기 좋게 데이터 가공 (색상, 심볼 포함)
        deck_list = []
        for dice_id in slots:
            # DICE_DATA에서 정보 조회 (없는 ID일 경우 기본값 fire 처리)
            info = DICE_DATA.get(dice_id, DICE_DATA["fire"])
            
            deck_list.append({
                "id": dice_id,
                "name": info["name"],
                "color": info["color"], # UI 렌더링에 필수
                "rarity": info["rarity"],
                "symbol": info.get("symbol", "ri-question-mark") # 아이콘 클래스
            })
            
        return {"deck": deck_list}
        
    except Exception as e:
        print(f"[Error] get_active_deck: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        conn.close()

# -------------------------------------------------------------------------
# 기존 API 유지
# -------------------------------------------------------------------------

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
        
        response_results = []
        for did in results_ids:
            info = DICE_DATA[did]
            response_results.append({
                "id": did,
                "name": info["name"],
                "rarity": info["rarity"],
                "color": info["color"],
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

@router.get("/deck/{username}")
async def get_my_deck(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        user_id = user["id"]
        rows = conn.execute("SELECT * FROM user_decks WHERE user_id = ? ORDER BY preset_index ASC", (user_id,)).fetchall()
        
        decks = {}
        default_deck_slots = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        for i in range(1, 8):
            found = next((r for r in rows if r["preset_index"] == i), None)
            if found:
                decks[i] = {
                    "name": found["deck_name"],
                    "slots": [found["slot_1"], found["slot_2"], found["slot_3"], found["slot_4"], found["slot_5"]]
                }
            else:
                default_name = f"Preset {i}"
                conn.execute("""
                    INSERT INTO user_decks (user_id, preset_index, deck_name, slot_1, slot_2, slot_3, slot_4, slot_5)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (user_id, i, default_name, *default_deck_slots))
                
                decks[i] = {
                    "name": default_name,
                    "slots": default_deck_slots
                }
        
        conn.commit()
        return {"decks": decks}
            
    finally:
        conn.close()

@router.post("/deck/save")
async def save_my_deck(payload: dict = Body(...)):
    username = payload.get("username")
    preset_index = payload.get("preset_index") 
    deck_name = payload.get("name")
    deck_slots = payload.get("deck")
    
    if not preset_index or not deck_slots or len(deck_slots) != 5:
        raise HTTPException(400, "Invalid deck format")
        
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        conn.execute("""
            INSERT INTO user_decks (user_id, preset_index, deck_name, slot_1, slot_2, slot_3, slot_4, slot_5)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, preset_index) DO UPDATE SET
                deck_name=excluded.deck_name,
                slot_1=excluded.slot_1,
                slot_2=excluded.slot_2,
                slot_3=excluded.slot_3,
                slot_4=excluded.slot_4,
                slot_5=excluded.slot_5
        """, (user["id"], preset_index, deck_name, *deck_slots))
        
        conn.commit()
        return {"message": "Deck saved"}
    finally:
        conn.close()

@router.get("/stats/{username}")
async def get_user_stats(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        
        user_id = user["id"]
        dice_rows = conn.execute("SELECT dice_id, class_level FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        
        user_dice_map = {row["dice_id"]: row["class_level"] for row in dice_rows}
        default_dice = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        for d_id in default_dice:
            if d_id not in user_dice_map:
                user_dice_map[d_id] = 1 
                
        total_crit_dmg = 100 
        for level in user_dice_map.values():
            total_crit_dmg += calculate_crit_damage_for_dice(level)
            
        return {
            "crit_rate": 5,
            "crit_damage": total_crit_dmg
        }
    finally:
        conn.close()