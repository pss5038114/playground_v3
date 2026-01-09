from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import importlib
from app.core.database import get_db_connection

router = APIRouter()

# ---------------------------------------------------------
# 1. 주사위 시스템 초기화 (동적 로드)
# ---------------------------------------------------------
DICE_REGISTRY = {}
DICE_LIST = ["fire", "electric", "wind", "poison", "ice", "iron"]

def load_dice_classes():
    """dice 폴더 내의 각 주사위 모듈을 로드하여 레지스트리에 등록"""
    # 주의: app/services/dice_defense/dice/__init__.py 가 반드시 존재해야 함
    base_path = "app.services.dice_defense.dice"
    
    for d_id in DICE_LIST:
        try:
            module_path = f"{base_path}.{d_id}.{d_id}"
            module = importlib.import_module(module_path)
            
            class_name = d_id.capitalize() + "Dice"
            cls = getattr(module, class_name)
            
            DICE_REGISTRY[d_id] = cls()
            print(f"✅ Loaded Dice: {d_id}")
            
        except Exception as e:
            print(f"⚠️ Failed to load dice {d_id}: {e}")

# 서버 시작 시 로드
load_dice_classes()

# ---------------------------------------------------------
# 2. API Models
# ---------------------------------------------------------
class DeckUpdateModel(BaseModel):
    username: str
    slot_index: int
    dice_id: Optional[str]

# ---------------------------------------------------------
# 3. API Endpoints
# ---------------------------------------------------------

@router.get("/inventory/{username}")
async def get_inventory_and_deck(username: str):
    conn = get_db_connection()
    try:
        # A. 유저 보유 주사위 조회
        user_dice_rows = conn.execute(
            "SELECT dice_id, level, count FROM user_dice WHERE user_id = ?", 
            (username,)
        ).fetchall()
        owned_map = {row['dice_id']: dict(row) for row in user_dice_rows}
        
        inventory_list = []
        
        for d_id in DICE_LIST:
            # 주사위 파일이 없어도 목록에는 뜨게 처리 (더미 데이터 사용)
            dice_obj = DICE_REGISTRY.get(d_id)
            
            # 주사위 로직 파일이 로드되지 않았다면 스킵 (혹은 기본값 표시)
            if not dice_obj:
                continue

            owned_data = owned_map.get(d_id)
            is_owned = owned_data is not None
            level = owned_data['level'] if is_owned else 1
            count = owned_data['count'] if is_owned else 0
            
            # [요청사항 반영] 다음 레벨업까지 무조건 1장 필요
            req_count = 1 
            
            stats = dice_obj.get_base_stats(level)
            
            inventory_list.append({
                "id": d_id,
                "name": dice_obj.name,
                "grade": dice_obj.grade,
                "description": dice_obj.description,
                "icon_char": dice_obj.icon_char,
                "color": dice_obj.color,
                "is_owned": is_owned,
                "level": level,
                "count": count,
                "req_count": req_count,
                "stats": stats,
                "preview_class": dice_obj.get_upgrade_preview(level),
                "preview_power": dice_obj.get_powerup_preview(level)
            })
            
        # B. 덱 정보 조회
        deck_row = conn.execute(
            "SELECT slot_0, slot_1, slot_2, slot_3, slot_4 FROM user_decks WHERE user_id = ?", 
            (username,)
        ).fetchone()
        current_deck = [deck_row[i] for i in range(5)] if deck_row else [None]*5
        
        # C. 유저 재화 조회
        user_row = conn.execute("SELECT gold, gem FROM users WHERE username = ?", (username,)).fetchone()
        user_resources = {"gold": user_row["gold"], "gem": user_row["gem"]} if user_row else {"gold":0, "gem":0}

        return {
            "inventory": inventory_list, 
            "deck": current_deck,
            "resources": user_resources
        }
    finally:
        conn.close()

@router.post("/deck/update")
async def update_deck(data: DeckUpdateModel):
    conn = get_db_connection()
    try:
        conn.execute("INSERT OR IGNORE INTO user_decks (user_id) VALUES (?)", (data.username,))
        row = conn.execute("SELECT * FROM user_decks WHERE user_id = ?", (data.username,)).fetchone()
        slots = [row[f"slot_{i}"] for i in range(5)]
        
        target_dice = data.dice_id
        target_slot = data.slot_index
        
        if target_dice is None:
            slots[target_slot] = None
        else:
            # 중복 방지 (Swap)
            existing_idx = -1
            try: existing_idx = slots.index(target_dice)
            except ValueError: pass
            
            if existing_idx != -1:
                temp = slots[target_slot]
                slots[target_slot] = target_dice
                slots[existing_idx] = temp 
            else:
                slots[target_slot] = target_dice

        conn.execute(f"UPDATE user_decks SET slot_0=?, slot_1=?, slot_2=?, slot_3=?, slot_4=? WHERE user_id=?", (*slots, data.username))
        conn.commit()
        return {"deck": slots}
    finally:
        conn.close()