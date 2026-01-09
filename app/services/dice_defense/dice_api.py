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
# 구현할 주사위 목록 정의
DICE_LIST = ["fire", "electric", "wind", "poison", "ice", "iron"]

def load_dice_classes():
    """dice 폴더 내의 각 주사위 모듈을 로드하여 레지스트리에 등록"""
    base_path = "app.services.dice_defense.dice"
    
    for d_id in DICE_LIST:
        try:
            # 예: app.services.dice_defense.dice.fire.fire
            module_path = f"{base_path}.{d_id}.{d_id}"
            module = importlib.import_module(module_path)
            
            # 클래스 이름 규칙: fire -> FireDice
            class_name = d_id.capitalize() + "Dice"
            cls = getattr(module, class_name)
            
            # 인스턴스 생성 및 등록
            DICE_REGISTRY[d_id] = cls()
            print(f"✅ Loaded Dice: {d_id}")
            
        except ImportError:
            print(f"⚠️ Dice module not found: {d_id} (Skipping)")
        except AttributeError:
            print(f"❌ Class {class_name} not found in {d_id}.py")
        except Exception as e:
            print(f"❌ Error loading {d_id}: {e}")

# 서버 시작 시 로드 시도
load_dice_classes()


# ---------------------------------------------------------
# 2. API Models
# ---------------------------------------------------------
class DeckUpdateModel(BaseModel):
    username: str
    slot_index: int  # 0~4
    dice_id: Optional[str] # 장착할 주사위 ID (해제 시 None)


# ---------------------------------------------------------
# 3. API Endpoints
# ---------------------------------------------------------

@router.get("/inventory/{username}")
async def get_inventory_and_deck(username: str):
    """유저의 전체 주사위 보유 현황과 장착 중인 덱 정보를 반환"""
    conn = get_db_connection()
    try:
        # A. 유저 보유 주사위 조회
        user_dice_rows = conn.execute(
            "SELECT dice_id, level, count FROM user_dice WHERE user_id = ?", 
            (username,)
        ).fetchall()
        
        # 보유 정보를 딕셔너리로 변환 {dice_id: {level, count}}
        owned_map = {row['dice_id']: dict(row) for row in user_dice_rows}
        
        inventory_list = []
        
        # 전체 주사위 목록을 순회하며 보유 여부와 스탯 계산
        for d_id in DICE_LIST:
            # 로드되지 않은 주사위(파일 없는 경우)는 목록에서 제외하거나 더미로 표시
            # 여기서는 레지스트리에 있는 것만 처리
            dice_obj = DICE_REGISTRY.get(d_id)
            
            # 미구현된 주사위라도 목록에는 띄우고 싶다면 임시 객체 생성 가능
            if not dice_obj:
                continue

            owned_data = owned_map.get(d_id)
            is_owned = owned_data is not None
            level = owned_data['level'] if is_owned else 1
            count = owned_data['count'] if is_owned else 0
            
            # 다음 클래스업 요구량 공식 (예: 레벨 * 2)
            req_count = level * 2 
            
            # 해당 레벨 기준 스탯 가져오기
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
        
        # 덱이 없으면 None으로 채워진 리스트 반환
        current_deck = [deck_row[i] for i in range(5)] if deck_row else [None]*5
        
        # C. 유저 재화 조회 (업그레이드용)
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
    """
    덱 수정 로직
    - 현재 슬롯에 주사위 장착/해제/교체
    - 중복 장착 방지 (Swap 로직 포함)
    """
    conn = get_db_connection()
    try:
        # 1. 덱 레코드가 없으면 생성
        conn.execute("INSERT OR IGNORE INTO user_decks (user_id) VALUES (?)", (data.username,))
        
        # 2. 현재 덱 가져오기
        row = conn.execute("SELECT * FROM user_decks WHERE user_id = ?", (data.username,)).fetchone()
        slots = [row[f"slot_{i}"] for i in range(5)]
        
        target_dice = data.dice_id
        target_slot = data.slot_index
        
        # 3. 로직 수행
        if target_dice is None:
            # [해제] 해당 슬롯 비움
            slots[target_slot] = None
        else:
            # [장착]
            # 이미 덱의 다른 위치에 이 주사위가 있는지 확인
            existing_idx = -1
            try:
                existing_idx = slots.index(target_dice)
            except ValueError:
                pass
            
            if existing_idx != -1:
                # 이미 존재함 -> 위치 교환 (Swap)
                # 기존 위치에 현재 슬롯의 내용을 넣고 (없으면 None), 현재 슬롯에 타겟 넣음
                temp = slots[target_slot]
                slots[target_slot] = target_dice
                slots[existing_idx] = temp 
            else:
                # 없음 -> 그냥 장착
                slots[target_slot] = target_dice

        # 4. DB 업데이트
        conn.execute(f"""
            UPDATE user_decks 
            SET slot_0=?, slot_1=?, slot_2=?, slot_3=?, slot_4=?
            WHERE user_id=?
        """, (*slots, data.username))
        
        conn.commit()
        return {"deck": slots, "status": "success"}
        
    except Exception as e:
        print(f"Deck Update Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# JS 파일 서빙 (비주얼 로직용, 필요 시 사용)
from fastapi.responses import FileResponse
@router.get("/script/{dice_id}")
async def get_dice_script(dice_id: str):
    path = f"app/services/dice_defense/dice/{dice_id}/{dice_id}.js"
    if os.path.exists(path):
        return FileResponse(path)
    # 파일이 없으면 404
    raise HTTPException(status_code=404, detail="Script not found")