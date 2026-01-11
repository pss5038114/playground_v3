from fastapi import APIRouter, HTTPException
from app.core.database import get_db_connection
from app.services.dice_defense.game_data import DICE_DATA, RARITY_ORDER

router = APIRouter()

@router.get("/list/{username}")
async def get_my_dice_list(username: str):
    conn = get_db_connection()
    try:
        # 1. 유저 ID 조회
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user_id = user["id"]

        # 2. DB에 저장된 내 주사위 조회
        rows = conn.execute("SELECT dice_id, class_level, quantity FROM user_dice WHERE user_id = ?", (user_id,)).fetchall()
        owned_map = {row["dice_id"]: dict(row) for row in rows}

        result = []
        updates_needed = []

        # 3. 전체 주사위 데이터와 병합
        for dice_id, info in DICE_DATA.items():
            dice_data = {
                "id": dice_id,
                "name": info["name"],
                "rarity": info["rarity"],
                "color": info["color"],
                "desc": info["desc"],
                "class_level": 0,
                "quantity": 0
            }

            if dice_id in owned_map:
                dice_data["class_level"] = owned_map[dice_id]["class_level"]
                dice_data["quantity"] = owned_map[dice_id]["quantity"]
            else:
                # [로직] 미소유 상태지만 일반(Common) 등급이면 Class 1로 자동 지급
                if info["rarity"] == "Common":
                    dice_data["class_level"] = 1
                    updates_needed.append((user_id, dice_id, 1, 0))

            result.append(dice_data)

        # 4. 자동 지급된 일반 주사위 DB 저장
        if updates_needed:
            conn.executemany(
                "INSERT INTO user_dice (user_id, dice_id, class_level, quantity) VALUES (?, ?, ?, ?)",
                updates_needed
            )
            conn.commit()

        # 5. 정렬: 등급(내림차순) -> 이름
        # (원하신다면 보유 여부로 먼저 정렬할 수도 있습니다)
        result.sort(key=lambda x: (RARITY_ORDER.get(x["rarity"], 0), x["id"]), reverse=True)
        
        return result
    finally:
        conn.close()