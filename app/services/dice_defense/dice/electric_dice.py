# app/services/dice_defense/dice/electric_dice.py
from .base_dice import BaseDice
import math

class ElectricDice(BaseDice):
    """
    [1] 타게팅: 최전방 (Base)
    [2] 발사: 순차 발사 (Base)
    [3] 데미지: 체인 라이트닝 (Unique)
       - 첫 타겟 100%, 주변 적 70%, 그 다음 30%
    """
    def on_hit(self, target: dict, projectile: dict, mobs: list):
        # 1차 타격 (100%)
        damage = projectile['damage']
        target['hp'] -= damage
        
        # 2차 타겟 찾기 (현재 타겟 주변 200px 이내)
        chain_range = 200
        chain_1 = self._find_closest_mob(target, mobs, exclude_ids=[target['id']], range_limit=chain_range)
        
        if chain_1:
            chain_1['hp'] -= damage * 0.7
            
            # 3차 타겟 찾기 (2차 타겟 주변)
            chain_2 = self._find_closest_mob(chain_1, mobs, exclude_ids=[target['id'], chain_1['id']], range_limit=chain_range)
            if chain_2:
                chain_2['hp'] -= damage * 0.3

    def _find_closest_mob(self, center_entity, mobs, exclude_ids, range_limit):
        candidates = []
        for m in mobs:
            if m['id'] in exclude_ids: continue
            dx = m['x'] - center_entity['x']
            dy = m['y'] - center_entity['y']
            dist = math.sqrt(dx*dx + dy*dy)
            if dist <= range_limit:
                candidates.append((dist, m))
        
        if not candidates: return None
        candidates.sort(key=lambda x: x[0]) # 거리순 정렬
        return candidates[0][1]