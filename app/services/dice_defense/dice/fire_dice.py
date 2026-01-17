# app/services/dice_defense/dice/fire_dice.py
from .base_dice import BaseDice
import math

class FireDice(BaseDice):
    """
    [1] 타게팅: 최전방
    [2] 발사: 순차 발사
    [3] 데미지: 스플래시 (반경 100px 내 적에게 50% 데미지)
    """
    def on_hit(self, target: dict, projectile: dict, mobs: list):
        # 메인 타겟
        damage = projectile['damage']
        target['hp'] -= damage
        
        # 스플래시
        splash_radius = 150
        for m in mobs:
            if m['id'] == target['id']: continue
            
            dx = m['x'] - target['x']
            dy = m['y'] - target['y']
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist <= splash_radius:
                m['hp'] -= damage * 0.5