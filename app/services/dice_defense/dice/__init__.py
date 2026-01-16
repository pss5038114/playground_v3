# app/services/dice_defense/dice/__init__.py

from .base_dice import BaseDice
# 추후 구현될 특수 주사위들도 여기서 import
# from .fire_dice import FireDice 

def create_dice_instance(dice_id: str, class_level: int, power_level: int = 1):
    """
    주사위 ID에 맞는 클래스를 찾아 인스턴스를 생성합니다.
    특수 로직이 구현되지 않은 주사위는 BaseDice를 반환합니다.
    """
    # 1. 특수 클래스 매핑 (나중에 여기에 추가)
    # dice_classes = {
    #     'fire': FireDice,
    #     'mining': MiningDice,
    # }
    
    # 2. 클래스 찾기
    # DiceClass = dice_classes.get(dice_id, BaseDice)
    
    # [현재는 모두 BaseDice로 처리]
    return BaseDice(dice_id, class_level, power_level)