from abc import ABC, abstractmethod

class DiceUnit(ABC):
    """
    모든 주사위의 기본 클래스 (Interface)
    """
    def __init__(self, dice_id: str, star: int = 1):
        self.dice_id = dice_id  # 인스턴스 고유 ID
        self.star = star        # 눈금 (1~7)
        self.name = "Unknown"
        self.type_id = "base"   # fire, ice, etc.
        self.attack_speed = 1.0
        self.damage = 10
        self.last_attack_time = 0.0

    @abstractmethod
    def attack(self, target_mobs: list, dt: float):
        """
        공격 로직 구현.
        target_mobs: 사거리 내에 있는 적들
        dt: 델타 타임
        """
        pass

    def upgrade(self):
        """눈금 증가 시 스탯 변화"""
        self.star += 1
        # 기본 로직: 데미지 증가 등