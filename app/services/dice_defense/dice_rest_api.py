# app/services/dice_defense/dice_rest_api.py

from fastapi import APIRouter, HTTPException, Body
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER, UPGRADE_RULES
import random
import math

router = APIRouter()

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

# [NEW] 기본 주사위 지급 헬퍼 함수
def ensure_default_dice(conn, user_id):
    """
    유저에게 기본 주사위 5종이 없으면 Lv.1로 지급합니다.
    """
    default_dice = ['fire', 'electric', 'wind', 'ice', 'poison']
    
    # 현재 보유 목록 확인
    existing = conn.execute("SELECT dice_id FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
    existing_ids = {row["dice_id"] for row in existing}
    
    for dice_id in default_dice:
        if dice_id not in existing_ids:
            # 기본 주사위는 Lv.1, 카드 0장으로 시작
            conn.execute(
                "INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, 0, 1)", 
                (user_id, dice_id)
            )
    conn.commit()

@router.get("/list/{username}")
async def get_my_dice_list(username: str):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
        
        user_id = user["id"]
        
        # [NEW] 접속 시 기본 주사위 확인 및 지급
        ensure_default_dice(conn, user_id)
        
        # 보유 주사위 조회
        rows = conn.execute("SELECT * FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        user_dice_map = {row["dice_id"]: row for row in rows}
        
        result = []
        # 게임 데이터에 있는 모든 주사위 정보를 내려줌 (보유/미보유 포함)
        for d_id, data in DICE_DATA.items():
            user_info = user_dice_map.get(d_id)
            
            current_level = user_info["class_level"] if user_info else 0
            quantity = user_info["quantity"] if user_info else 0
            
            # 다음 레벨 업그레이드 비용 계산
            next_cost = None
            if current_level < 20:
                # 리스트 인덱스는 (현재 레벨) 입니다.
                # Lv.0 -> Lv.1 (index 0)
                # Lv.1 -> Lv.2 (index 1)
                idx = current_level 
                
                if idx < len(UPGRADE_RULES["gold"]):
                    req_gold = UPGRADE_RULES["gold"][idx]
                    req_cards = UPGRADE_RULES["cards"][data["rarity"]][idx]
                    
                    # [중요] 0레벨(해금)일 경우 골드 비용은 0원
                    if current_level == 0:
                        req_gold = 0
                        
                    next_cost = {"gold": req_gold, "cards": req_cards}

            result.append({
                "id": d_id,
                "name": data["name"],
                "rarity": data["rarity"],
                "color": data["color"],
                "symbol": data["symbol"],
                "desc": data["desc"],
                "stats": data["stats"],
                "class_level": current_level,
                "quantity": quantity,
                "next_cost": next_cost
            })
            
        return result
    finally:
        conn.close()

@router.post("/summon")
async def summon_dice(payload: dict = Body(...)):
    username = payload.get("username")
    count = payload.get("count", 1)
    
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            raise HTTPException(404, "User not found")
            
        cost = 100 * count # 1회당 100 다이아 (가정)
        if user["gems"] < cost:
            raise HTTPException(400, "Not enough gems")
            
        # 재화 차감
        new_gems = user["gems"] - cost
        conn.execute("UPDATE users SET gems = ? WHERE id = ?", (new_gems, user["id"]))
        
        results = []
        for _ in range(count):
            # 랜덤 뽑기 로직 (가중치 적용)
            rand = random.random()
            if rand < 0.07: rarity = "Legend"   # 7%
            elif rand < 0.25: rarity = "Hero"   # 18%
            elif rand < 0.55: rarity = "Rare"   # 30%
            else: rarity = "Common"             # 45%
            
            candidates = [d_id for d_id, d in DICE_DATA.items() if d["rarity"] == rarity]
            if not candidates:
                candidates = list(DICE_DATA.keys())
                
            picked_id = random.choice(candidates)
            
            # DB 업데이트 (수량 증가)
            user_dice = conn.execute("SELECT * FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], picked_id)).fetchone()
            
            if user_dice:
                new_qty = user_dice["quantity"] + 1
                conn.execute("UPDATE user_dice SET quantity = ? WHERE id = ?", (new_qty, user_dice["id"]))
            else:
                # 처음 획득했더라도 레벨은 0 (미보유 상태, 카지만 1장 획득)
                # 해금을 해야 1레벨이 됨.
                conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, 1, 0)", (user["id"], picked_id))
            
            results.append({"id": picked_id, "name": DICE_DATA[picked_id]["name"], "rarity": rarity})
            
        conn.commit()
        return {"results": results, "new_gems": new_gems}
        
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
        
        if dice_id not in DICE_DATA:
            raise HTTPException(400, "Invalid dice ID")
            
        rarity = DICE_DATA[dice_id]["rarity"]
        
        # [수정] 비용 계산 로직 (KeyError 해결)
        if current_level >= 20:
            raise HTTPException(400, "Max level reached")
            
        # UPGRADE_RULES는 이제 List 구조입니다.
        # index 0: Lv.0 -> Lv.1 (Unlock)
        # index 1: Lv.1 -> Lv.2
        idx = current_level
        if idx >= len(UPGRADE_RULES["gold"]):
             raise HTTPException(400, "Max level config reached")

        req_cards = UPGRADE_RULES["cards"][rarity][idx]
        req_gold = UPGRADE_RULES["gold"][idx]
        
        # 0레벨(해금)인 경우 골드 비용은 0으로 강제
        if current_level == 0:
            req_gold = 0
        
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
            # 데이터가 아예 없었다면 INSERT (0레벨 -> 1레벨)
            conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, ?, ?)", 
                         (user["id"], dice_id, new_quantity, new_level))
            
        conn.commit()
        return {"message": "Upgraded", "new_level": new_level, "new_gold": new_gold}
        
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
        
        # 1. DB 조회
        dice_rows = conn.execute("SELECT dice_id, class_level FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        user_dice_map = {row["dice_id"]: row["class_level"] for row in dice_rows}
        
        # 2. 기본 주사위도 맵에 포함 (DB에 없어도 Lv.1 취급)
        # (ensure_default_dice가 list 호출 시 실행되지만, stats만 따로 호출될 경우를 대비)
        default_dice = ['fire', 'electric', 'wind', 'ice', 'poison']
        for d_id in default_dice:
            if d_id not in user_dice_map:
                user_dice_map[d_id] = 1
                
        # 3. 크리티컬 데미지 계산
        total_crit_dmg = 100 # 기본 100%
        
        for level in user_dice_map.values():
            total_crit_dmg += calculate_crit_damage_for_dice(level)
            
        return {
            "crit_rate": 5,
            "crit_damage": total_crit_dmg
        }
    finally:
        conn.close()