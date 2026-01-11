# app/services/dice_defense/dice_api.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.core.session_manager import session_manager
from app.core.database import get_db_connection
from app.services.dice_defense.dice_logic import execute_gacha
# [수정] 정확한 임포트 경로
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

@router.post("/gacha")
async def pull_gacha(req: GachaRequest):
    if req.draw_count not in [1, 10]:
        raise HTTPException(status_code=400, detail="1회 또는 10회 뽑기만 가능합니다.")
    cost = 1 * req.draw_count 
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT tickets FROM users WHERE username = ?", (req.username,)).fetchone()
        if not user: raise HTTPException(status_code=404, detail="유저 없음")
        if user['tickets'] < cost: raise HTTPException(status_code=400, detail="티켓 부족")
        conn.execute("UPDATE users SET tickets = tickets - ? WHERE username = ?", (cost, req.username))
        acquired_dice_ids = execute_gacha(req.draw_count)
        for dice_id in acquired_dice_ids:
            row = conn.execute("SELECT id FROM user_dice WHERE user_id = ? AND dice_id = ?", (req.username, dice_id)).fetchone()
            if row: conn.execute("UPDATE user_dice SET card_count = card_count + 1 WHERE id = ?", (row['id'],))
            else: conn.execute("INSERT INTO user_dice (user_id, dice_id, class_level, card_count) VALUES (?, ?, 0, 1)", (req.username, dice_id))
        conn.commit()
        result_details = []
        for did in acquired_dice_ids:
            info = DICE_DATA.get(did, {})
            result_details.append({"id": did, "name": info.get("name", "Unknown"), "rarity": info.get("rarity", "Common")})
        return {"message": "가챠 성공", "results": result_details}
    finally: conn.close()

@router.get("/list/{username}")
async def get_dice_inventory(username: str):
    conn = get_db_connection()
    try:
        rows = conn.execute("SELECT dice_id, class_level, card_count FROM user_dice WHERE user_id = ?", (username,)).fetchall()
        user_dice_map = {row['dice_id']: dict(row) for row in rows}
        inventory = []
        for dice_id, info in DICE_DATA.items():
            user_data = user_dice_map.get(dice_id, {"class_level": 0, "card_count": 0})
            level = user_data["class_level"]
            req_card = 1 if level == 0 else 5
            req_gold = 0 if level == 0 else level * 500
            inventory.append({
                "id": dice_id, "name": info["name"], "rarity": info["rarity"], "level": level,
                "card_count": user_data["card_count"], "req_card": req_card, "req_gold": req_gold,
                "can_upgrade": user_data["card_count"] >= req_card, "is_owned": level > 0
            })
        return inventory
    finally: conn.close()

@router.post("/upgrade")
async def upgrade_dice(req: UpgradeRequest):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT gold FROM users WHERE username = ?", (req.username,)).fetchone()
        dice_row = conn.execute("SELECT id, class_level, card_count FROM user_dice WHERE user_id = ? AND dice_id = ?", (req.username, req.dice_id)).fetchone()
        if not dice_row: raise HTTPException(status_code=400, detail="데이터 없음")
        level = dice_row["class_level"]
        req_card = 1 if level == 0 else 5
        req_gold = 0 if level == 0 else level * 500
        if dice_row["card_count"] < req_card or user["gold"] < req_gold: raise HTTPException(status_code=400, detail="조건 부족")
        if req_gold > 0: conn.execute("UPDATE users SET gold = gold - ? WHERE username = ?", (req_gold, req.username))
        conn.execute("UPDATE user_dice SET class_level = ?, card_count = ? WHERE id = ?", (level + 1, dice_row["card_count"] - req_card, dice_row["id"]))
        conn.commit()
        return {"success": True}
    finally: conn.close()

@router.websocket("/ws/game/{session_id}")
async def dice_game_ws(websocket: WebSocket, session_id: str):
    session = session_manager.get_or_create_session(session_id)
    await session.add_player(websocket)
    try:
        while True: await websocket.receive_json()
    except WebSocketDisconnect: session.remove_player(websocket)