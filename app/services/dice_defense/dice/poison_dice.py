# app/services/dice_defense/dice/poison_dice.py
from .base_dice import BaseDice

class PoisonDice(BaseDice):
    """
    [1] 타게팅: 독 없는 적 우선 -> 없으면 최전방
    [2] 발사: 순차 발사 (Base)
    [3] 데미지: 독 상태이상 부여 (Unique)
    """
    def find_target(self, dice_state: dict, mobs: list):
        if not mobs: return None
        
        # 독 안 걸린 적 필터링
        non_poisoned = [m for m in mobs if 'poison_stacks' not in m or m['poison_stacks'] == 0]
        
        if non_poisoned:
            # 독 없는 애들 중 최전방
            return self._target_front(dice_state, non_poisoned)
        else:
            # 모두 독 걸렸으면 그냥 최전방
            return self._target_front(dice_state, mobs)

    def on_hit(self, target: dict, projectile: dict, mobs: list):
        # 기본 데미지 (작게라도 줌)
        target['hp'] -= projectile['damage']
        
        # 독 스택 부여 (몹 데이터 구조에 effects 딕셔너리 필요, 임시로 속성 추가)
        # 실제로는 Entity 클래스에서 update 로직으로 DoT를 처리해야 함.
        # 여기서는 "독에 걸렸다"는 표시만 남김
        if 'effects' not in target: target['effects'] = {}
        
        # 독 효과 (예: 5초간 1초마다 데미지) - game.py 엔티티 업데이트에서 처리 필요
        target['effects']['poison'] = {
            'damage': projectile['damage'] * 0.5, # 틱당 데미지
            'duration': 5.0,
            'start_time': 0 # game.py에서 현재시간 넣어줘야 함
        }