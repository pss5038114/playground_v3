# app/services/dice_defense/dice/base_dice.py
import math
import random
import time

class BaseDice:
    def __init__(self, dice_id: str, data: dict):
        self.id = dice_id
        self.data = data
        
        # 공격 관련 상태 (인스턴스마다 별도 관리 필요하므로 game.py의 grid에 저장된 상태를 활용해야 함)
        # 하지만 여기서는 로직 클래스이므로, 상태값(dict)을 인자로 받아 처리합니다.

    # ... (기존 can_merge_with, on_merge 유지) ...
    def can_merge_with(self, my_state: dict, target_state: dict) -> bool:
        if not target_state: return False
        return (self.id == target_state['id'] and my_state['level'] == target_state['level'])

    def on_merge(self, my_state: dict, target_state: dict, deck: list) -> dict:
        new_level = my_state['level'] + 1
        if new_level > 7: new_level = 7
        new_id = random.choice(deck)
        return {'id': new_id, 'level': new_level}

    # [NEW] 공격 업데이트 로직
    def update_attack(self, dice_state: dict, mobs: list, dt: float, current_time: float):
        """
        주사위의 쿨타임을 체크하고, 공격 가능하다면 타겟을 찾아 발사 정보를 반환함.
        """
        # 1. 쿨타임 초기화 체크
        if 'last_attack_time' not in dice_state:
            dice_state['last_attack_time'] = 0
            
        # 2. 공격 속도 (기본 1.0초, 레벨업 시 빨라지게 하거나 데이터에서 가져옴)
        # 예: 기본 1.5초 - (레벨 * 0.1)
        attack_interval = max(0.5, 1.5 - (dice_state['level'] * 0.1))
        
        # 3. 쿨타임 체크
        if current_time - dice_state['last_attack_time'] >= attack_interval:
            # 4. 타겟 탐색 (Front: 경로 인덱스가 가장 큰 적)
            target = self._find_target_front(dice_state, mobs)
            
            if target:
                dice_state['last_attack_time'] = current_time
                dice_state['target_id'] = target['id'] # 시각적 연결용
                
                # 투사체 생성 정보 반환
                return {
                    "type": "projectile",
                    "damage": 10 * dice_state['level'], # 데미지 공식
                    "speed": 600, # 투사체 속도
                    "target_id": target['id'],
                    "start_x": dice_state['cx'], # 그리드 중심 (game.py에서 주입 필요)
                    "start_y": dice_state['cy']
                }
        
        # 타겟이 없거나 쿨타임 중이면 타겟 ID 초기화 (선 지우기)
        if current_time - dice_state['last_attack_time'] > 0.2:
             dice_state['target_id'] = None
             
        return None

    def _find_target_front(self, dice_state, mobs):
        """
        가장 앞서가는(finish에 가까운) 적을 찾음.
        거리 제한(사거리)이 있다면 여기서 체크.
        """
        if not mobs:
            return None
            
        # path_index가 클수록, 그리고 같은 index라면 다음 노드까지 거리가 가까울수록 앞선 적임.
        # 간단하게 path_index가 가장 큰 적을 선택
        # (더 정교하게 하려면 총 이동 거리를 계산해야 함)
        
        # 사거리 체크 (예: 반경 300px)
        range_radius = 250
        
        candidates = []
        dice_x = dice_state.get('cx', 0)
        dice_y = dice_state.get('cy', 0)

        for mob in mobs:
            dx = mob['x'] - dice_x
            dy = mob['y'] - dice_y
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist <= range_radius:
                candidates.append(mob)
        
        if not candidates:
            return None
            
        # path_index 역순 정렬 (큰게 0번) -> 가장 앞선 놈
        candidates.sort(key=lambda m: m['path_index'], reverse=True)
        return candidates[0]