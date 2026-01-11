# app/services/dice_defense/dice/fire_dice.py
from app.services.dice_defense.dice.base_dice import BaseDice

class FireDice(BaseDice):
    """
    [불 주사위]
    특징: 기본 데미지가 높고, 체력이 높은 적에게 추가 데미지.
    """
    @property
    def name(self) -> str:
        return "Fire"

    @property
    def base_damage(self) -> float:
        return 30.0 # 기본보다 강력함

    @property
    def attack_interval(self) -> float:
        return 1.2 # 약간 느림

    def on_attack(self, target, game_state):
        # 예: 적 체력이 50% 이상이면 데미지 1.5배 로직 등 구현 가능
        damage = self.calculate_damage({})
        
        # 가상의 타겟 객체 구조 가정
        if hasattr(target, 'hp') and hasattr(target, 'max_hp'):
            if target.hp > target.max_hp * 0.5:
                damage *= 1.5
                
        return {"type": "DAMAGE", "value": damage, "target_id": target.id}