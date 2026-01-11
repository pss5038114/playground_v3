# app/services/dice_defense/dice/base_dice.py
from typing import List, Dict, Any

class BaseDice:
    """
    모든 주사위의 기본 클래스입니다.
    """
    def __init__(self, level: int = 1, dot_count: int = 1):
        self.level = level      # 클래스 레벨 (강화 수치)
        self.dot_count = dot_count  # 눈금 수 (1~7성)
        self.target_mode = "FRONT" # FRONT, BACK, RANDOM, STRONG

    @property
    def name(self) -> str:
        return "Base"

    @property
    def base_damage(self) -> float:
        return 10.0

    @property
    def attack_interval(self) -> float:
        """공격 속도 (초 단위)"""
        return 1.0

    def calculate_damage(self, buffs: Dict[str, Any]) -> float:
        """
        최종 데미지 계산: (기본공격력 + 레벨보너스) * 눈금수 * 버프
        """
        dmg = (self.base_damage + (self.level * 5)) * self.dot_count
        
        # 버프 적용 예시 (합연산)
        if "damage_mul" in buffs:
            dmg *= buffs["damage_mul"]
            
        return dmg

    def on_attack(self, target: Any, game_state: Any):
        """
        공격 시 발동하는 로직. 
        단순 데미지 외에 슬로우, 스플래시 등 특수 효과 구현 시 오버라이딩.
        """
        pass