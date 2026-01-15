# app/services/dice_defense/dice_rest_api.py
from fastapi import APIRouter, HTTPException, Body
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

# [NEW] 크리티컬 데미지 계산 헬퍼 함수
def calculate_crit_damage_for_dice(class_level: int) -> int:
    """
    주사위 하나가 기여하는 크리티컬 데미지 계산
    공식: 1, 1, 2, 2, 3, 3, 4... 순서로 누적
    즉, 레벨 L까지의 sum(ceil(i/2))
    """
    if class_level < 1:
        return 0
    
    total = 0
    for i in range(1, class_level + 1):
        total += math.ceil(i / 2)
    return total

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
        
        # 주사위 정보 조회
        user_dice = conn.execute("SELECT * FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], dice_id)).fetchone()
        
        current_level = user_dice["class_level"] if user_dice else 0
        current_quantity = user_dice["quantity"] if user_dice else 0
        
        # 만약 데이터가 없으면(아예 처음) 0레벨로 취급
        
        # [수정] 비용 계산 로직
        if current_level >= 20:
            raise HTTPException(400, "Max level reached")
            
        # UPGRADE_RULES에서 가져오되, 0레벨(해금)인 경우 골드 비용은 0으로 강제
        # (기존 데이터에 0레벨 골드 비용이 설정되어 있어도 무시)
        req_cards = UPGRADE_RULES[current_level]["cards"]
        req_gold = 0 if current_level == 0 else UPGRADE_RULES[current_level]["gold"]
        
        if current_quantity < req_cards:
            raise HTTPException(400, "Not enough cards")
        if user["gold"] < req_gold:
            raise HTTPException(400, "Not enough gold")
            
        # 차감 및 업데이트
        new_gold = user["gold"] - req_gold
        new_quantity = current_quantity - req_cards
        new_level = current_level + 1
        
        conn.execute("UPDATE users SET gold = ? WHERE id = ?", (new_gold, user["id"]))
        
        if user_dice:
            conn.execute("UPDATE user_dice SET quantity = ?, class_level = ? WHERE id = ?", (new_quantity, new_level, user_dice["id"]))
        else:
            # 0레벨 -> 1레벨 (첫 획득) INSERT
            conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, ?, ?)", 
                         (user["id"], dice_id, new_quantity, new_level))
            
        conn.commit()
        return {"message": "Upgraded", "new_level": new_level, "new_gold": new_gold}
        
    finally:
        conn.close()

# [NEW] 덱 정보 불러오기
@router.get("/deck/{username}")
async def get_my_deck(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        user_id = user["id"]
        
        # 모든 프리셋 조회
        rows = conn.execute("SELECT * FROM user_decks WHERE user_id = ? ORDER BY preset_index ASC", (user_id,)).fetchall()
        
        decks = {}
        # 기본 덱 (데이터가 없을 경우를 대비)
        default_deck_slots = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        # 1~7번 프리셋 확인 및 생성
        for i in range(1, 8):
            found = next((r for r in rows if r["preset_index"] == i), None)
            if found:
                decks[i] = {
                    "name": found["deck_name"],
                    "slots": [found["slot_1"], found["slot_2"], found["slot_3"], found["slot_4"], found["slot_5"]]
                }
            else:
                # 없으면 DB에 기본값 생성
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
        return {"decks": decks} # { "1": {name:..., slots:[...]}, ... }
            
    finally:
        conn.close()

# 덱 정보 저장하기
@router.post("/deck/save")
async def save_my_deck(payload: dict = Body(...)):
    username = payload.get("username")
    preset_index = payload.get("preset_index") # 1~7
    deck_name = payload.get("name")
    deck_slots = payload.get("deck") # ["id1", ...]
    
    if not preset_index or not deck_slots or len(deck_slots) != 5:
        raise HTTPException(400, "Invalid deck format")
        
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        
        # 해당 프리셋 업데이트 (INSERT OR REPLACE)
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
        
        # 1. DB에 저장된 주사위 목록 조회
        dice_rows = conn.execute("SELECT dice_id, class_level FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        
        # DB 데이터를 딕셔너리로 변환 { "fire": 2, "ice": 1, ... }
        user_dice_map = {row["dice_id"]: row["class_level"] for row in dice_rows}
        
        # 2. 기본 지급 주사위 정의
        default_dice = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        # 3. 기본 주사위가 DB에 없으면 Lv.1로 간주하고 맵에 추가
        for d_id in default_dice:
            if d_id not in user_dice_map:
                user_dice_map[d_id] = 1 # 기본 1레벨
                
        # 4. 크리티컬 데미지 계산
        total_crit_dmg = 100 # 기본 100%
        
        for level in user_dice_map.values():
            total_crit_dmg += calculate_crit_damage_for_dice(level)
            
        return {
            "crit_rate": 5, # 5% 고정
            "crit_damage": total_crit_dmg
        }
    finally:
        conn.close()