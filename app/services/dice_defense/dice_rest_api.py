# app/services/dice_defense/dice_rest_api.py
from fastapi import APIRouter, HTTPException, Body
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER, UPGRADE_RULES
from app.services.dice_defense.modes.solo.game import SoloGameSession
# SessionManager가 있다면 import, 없다면 임시 전역 변수 사용
# from app.core.session_manager import session_manager 
import random
import math

# 간단한 세션 저장소 (실제 서비스에선 Redis 등을 사용하거나 session_manager 활용)
active_games = {} 

router = APIRouter()

# ... (기존 변수 및 함수: RARITY_WEIGHTS, pick_one_dice, calculate_crit_damage_for_dice 등 유지) ...
RARITY_WEIGHTS = [("Common", 0.55), ("Rare", 0.28), ("Hero", 0.14), ("Legend", 0.03)]

def pick_one_dice():
    r = random.random()
    cumulative = 0.0
    selected_rarity = "Common"
    for rarity, weight in RARITY_WEIGHTS:
        cumulative += weight
        if r <= cumulative:
            selected_rarity = rarity
            break
    candidates = [did for did, info in DICE_DATA.items() if info["rarity"] == selected_rarity]
    if not candidates: candidates = list(DICE_DATA.keys())
    return random.choice(candidates)

def calculate_crit_damage_for_dice(class_level: int) -> int:
    if class_level < 1: return 0
    total = 0
    for i in range(1, class_level + 1):
        total += math.ceil(i / 2)
    return total

# ... (기존 API: /list, /summon, /upgrade, /deck, /deck/save, /stats 유지) ...
# (코드가 길어 생략된 부분은 기존 코드를 그대로 유지해주세요. 아래에 추가되는 API만 작성합니다.)

@router.get("/list/{username}")
async def get_my_dice_list(username: str):
    # ... (기존 코드 유지) ...
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
                "id": dice_id, "name": info["name"], "rarity": info["rarity"], "color": info["color"],
                "symbol": info.get("symbol", "ri-dice-fill"), "desc": info["desc"], "stats": info.get("stats", {}),
                "class_level": 0, "quantity": 0, "next_cost": None
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
                dice_data["next_cost"] = {"gold": UPGRADE_RULES["gold"][curr_lv], "cards": UPGRADE_RULES["cards"][rarity][curr_lv]}
            result.append(dice_data)
        if updates_needed:
            conn.executemany("INSERT INTO user_dice (user_id, dice_id, class_level, quantity) VALUES (?, ?, ?, ?)", updates_needed)
            conn.commit()
        result.sort(key=lambda x: (RARITY_ORDER.get(x["rarity"], 0), x["id"]), reverse=True)
        return result
    finally: conn.close()

@router.post("/summon")
async def summon_dice(payload: dict = Body(...)):
    # ... (기존 코드 유지) ...
    username = payload.get("username")
    count = payload.get("count", 1) 
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id, tickets FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        ticket_cost = 1 if count == 1 else 10
        if user["tickets"] < ticket_cost: raise HTTPException(400, "티켓이 부족합니다.")
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE id = ?", (ticket_cost, user["id"]))
        real_count = 11 if count == 10 else 1
        results_ids = [pick_one_dice() for _ in range(real_count)]
        result_summary = {} 
        for did in results_ids: result_summary[did] = result_summary.get(did, 0) + 1
        for did, qty in result_summary.items():
            row = conn.execute("SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", (user["id"], did)).fetchone()
            if row: conn.execute("UPDATE user_dice SET quantity = quantity + ? WHERE id = ?", (qty, row["id"]))
            else: conn.execute("INSERT INTO user_dice (user_id, dice_id, quantity, class_level) VALUES (?, ?, ?, 0)", (user["id"], did, qty))
        conn.commit()
        response_results = []
        for did in results_ids:
            info = DICE_DATA[did]
            response_results.append({ "id": did, "name": info["name"], "rarity": info["rarity"], "color": info["color"], "symbol": info.get("symbol", "ri-dice-fill"), "desc": info["desc"] })
        return { "results": response_results, "remaining_tickets": user["tickets"] - ticket_cost }
    except Exception as e:
        conn.rollback(); raise e
    finally: conn.close()

@router.post("/upgrade")
async def upgrade_dice(payload: dict = Body(...)):
    # ... (기존 코드 유지) ...
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
        if current_level >= 20: raise HTTPException(400, "이미 최대 레벨입니다.")
        dice_info = DICE_DATA.get(dice_id)
        if not dice_info: raise HTTPException(400, "잘못된 주사위 ID")
        rarity = dice_info["rarity"]
        req_gold = UPGRADE_RULES["gold"][current_level]
        req_cards = UPGRADE_RULES["cards"][rarity][current_level]
        if quantity < req_cards: raise HTTPException(400, "카드가 부족합니다.")
        if user["gold"] < req_gold: raise HTTPException(400, "골드가 부족합니다.")
        conn.execute("UPDATE user_dice SET quantity = quantity - ?, class_level = class_level + 1 WHERE id = ?", (req_cards, dice_row["id"]))
        conn.execute("UPDATE users SET gold = gold - ? WHERE id = ?", (req_gold, user["id"]))
        conn.commit()
        return {"message": "Success", "new_level": current_level + 1}
    finally: conn.close()

@router.get("/deck/{username}")
async def get_my_deck(username: str):
    # ... (기존 코드 유지) ...
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
            if found: decks[i] = { "name": found["deck_name"], "slots": [found["slot_1"], found["slot_2"], found["slot_3"], found["slot_4"], found["slot_5"]] }
            else:
                default_name = f"Preset {i}"
                conn.execute("INSERT INTO user_decks (user_id, preset_index, deck_name, slot_1, slot_2, slot_3, slot_4, slot_5) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (user_id, i, default_name, *default_deck_slots))
                decks[i] = { "name": default_name, "slots": default_deck_slots }
        conn.commit()
        return {"decks": decks}
    finally: conn.close()

@router.post("/deck/save")
async def save_my_deck(payload: dict = Body(...)):
    # ... (기존 코드 유지) ...
    username = payload.get("username")
    try: preset_index = int(payload.get("preset_index", 1))
    except: raise HTTPException(400, "잘못된 프리셋 번호입니다.")
    deck_name = payload.get("name", f"Preset {preset_index}")
    deck_slots = payload.get("deck") 
    if not deck_slots or len(deck_slots) != 5: raise HTTPException(400, "덱 형식이 올바르지 않습니다.")
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,)).fetchone()
        if not user: raise HTTPException(404, "사용자를 찾을 수 없습니다.")
        user_id = user["id"]
        conn.execute("INSERT INTO user_decks (user_id, preset_index, deck_name, slot_1, slot_2, slot_3, slot_4, slot_5) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, preset_index) DO UPDATE SET deck_name=excluded.deck_name, slot_1=excluded.slot_1, slot_2=excluded.slot_2, slot_3=excluded.slot_3, slot_4=excluded.slot_4, slot_5=excluded.slot_5", (user_id, preset_index, deck_name, *deck_slots))
        conn.commit()
        return {"status": "success", "message": "덱이 저장되었습니다."}
    except Exception as e: conn.rollback(); raise HTTPException(500, f"서버 오류: {str(e)}")
    finally: conn.close()

@router.get("/stats/{username}")
async def get_user_stats(username: str):
    # ... (기존 코드 유지) ...
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        user_id = user["id"]
        dice_rows = conn.execute("SELECT dice_id, class_level FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        user_dice_map = {row["dice_id"]: row["class_level"] for row in dice_rows}
        default_dice = ['fire', 'electric', 'wind', 'ice', 'poison']
        for d_id in default_dice:
            if d_id not in user_dice_map: user_dice_map[d_id] = 1 
        total_crit_dmg = 100 
        for level in user_dice_map.values(): total_crit_dmg += calculate_crit_damage_for_dice(level)
        return { "crit_rate": 5, "crit_damage": total_crit_dmg }
    finally: conn.close()

# ----------------------------------------------------------------------
# [NEW] 게임 시작 API
# ----------------------------------------------------------------------
@router.post("/game/solo/start")
async def start_solo_game(payload: dict = Body(...)):
    """
    솔로 게임 시작:
    1. 유저 확인
    2. 선택한 프리셋(덱) 정보 가져오기
    3. 게임 세션 생성 (SP, Lives, Map 초기화)
    4. 덱에 포함된 주사위들의 상세 정보(이미지, 스탯 등) 반환
    """
    username = payload.get("username")
    preset_index = int(payload.get("preset_index", 1)) # 기본값 1번 덱
    
    conn = get_db_connection()
    try:
        # 1. 유저 조회
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user: raise HTTPException(404, "User not found")
        user_id = user["id"]
        
        # 2. 덱 정보 조회
        deck_row = conn.execute("SELECT * FROM user_decks WHERE user_id = ? AND preset_index = ?", (user_id, preset_index)).fetchone()
        
        # 덱이 없으면 기본 덱 사용
        if deck_row:
            deck_ids = [deck_row["slot_1"], deck_row["slot_2"], deck_row["slot_3"], deck_row["slot_4"], deck_row["slot_5"]]
        else:
            deck_ids = ['fire', 'electric', 'wind', 'ice', 'poison']
            
        # 3. 게임 세션 생성 (메모리에 저장)
        session = SoloGameSession(user_id, deck_ids)
        active_games[session.game_id] = session # 실제로는 Redis나 DB 등을 써야 함
        
        # 4. 클라이언트용 데이터 구성
        initial_data = session.get_initial_state()
        
        # 5. 덱 주사위들의 상세 정보(UI 표시용) 추가
        deck_details = []
        for did in deck_ids:
            info = DICE_DATA.get(did, DICE_DATA['fire']) # fallback
            # 유저의 해당 주사위 클래스 레벨 등도 필요하면 조회해야 함. 일단 기본 정보 전송
            deck_details.append({
                "id": did,
                "name": info["name"],
                "color": info["color"],
                "symbol": info.get("symbol", "ri-dice-fill"),
                "rarity": info["rarity"]
            })
            
        initial_data["deck_details"] = deck_details
        
        return initial_data
        
    finally:
        conn.close()