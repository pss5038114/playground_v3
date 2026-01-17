# app/services/dice_defense/dice/__init__.py
from app.services.dice_defense.game_data import DICE_DATA
from .base_dice import BaseDice
from .fire_dice import FireDice

# [중요] 주사위 ID와 클래스 매핑
DICE_CLASS_MAP = {
    'fire': FireDice,
    # 'electric': ElectricDice, (추후 추가)
}

def get_dice_logic(dice_id: str):
    """주사위 ID에 해당하는 로직 인스턴스를 반환"""
    dice_class = DICE_CLASS_MAP.get(dice_id, BaseDice) # 매핑 안된건 기본 로직
    dice_data = DICE_DATA.get(dice_id, {})
    return dice_class(dice_id, dice_data)