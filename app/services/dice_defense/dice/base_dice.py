# app/services/dice_defense/dice/base_dice.py
import random

class BaseDice:
    def __init__(self, dice_id: str, data: dict):
        self.id = dice_id
        self.data = data  # game_data.py에서 가져온 정보

    def can_merge_with(self, my_state: dict, target_state: dict) -> bool:
        """
        기본 결합 규칙:
        1. 대상이 존재해야 함 (None 아님)
        2. 같은 종류(ID)여야 함
        3. 같은 눈(Level)이어야 함
        """
        if not target_state:
            return False
        
        return (self.id == target_state['id'] and 
                my_state['level'] == target_state['level'])

    def on_merge(self, my_state: dict, target_state: dict, deck: list) -> dict:
        """
        결합 실행 시 호출되는 로직.
        기본 동작: 눈이 1 증가하고, 덱에 있는 무작위 주사위로 변함.
        """
        new_level = my_state['level'] + 1
        if new_level > 7: 
            new_level = 7 # 최대 레벨 제한 (7성)
            
        # 덱에 있는 주사위 중 랜덤 선택
        new_id = random.choice(deck)
        
        return {
            'id': new_id,
            'level': new_level
        }