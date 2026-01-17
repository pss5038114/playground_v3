# app/services/dice_defense/dice/base_dice.py
import math
import random

class BaseDice:
    def __init__(self, dice_id: str, data: dict):
        self.id = dice_id
        self.data = data # game_data.py의 정보 (speed, damage 등)

    # ... (can_merge_with, on_merge는 기존과 동일) ...
    def can_merge_with(self, my_state: dict, target_state: dict) -> bool:
        if not target_state: return False
        return (self.id == target_state['id'] and my_state['level'] == target_state['level'])

    def on_merge(self, my_state: dict, target_state: dict, deck: list) -> dict:
        new_level = my_state['level'] + 1
        if new_level > 7: new_level = 7
        new_id = random.choice(deck)
        return {'id': new_id, 'level': new_level}

    # [수정] 공격 로직 개선 (사거리 제거, 눈 순환 발사)
    def update_attack(self, dice_state: dict, mobs: list, dt: float, current_time: float, dice_size: int = 100):
        # 1. 기본 스탯 가져오기
        base_speed = self.data.get('speed', 1.0) # 예: 1.0초
        level = dice_state['level']
        
        # 2. 레벨에 따른 발사 간격 (DPS = 데미지 * 레벨 / 기본속도)
        # 예: 1.0초 주사위 -> 1성: 1.0초마다, 3성: 0.33초마다
        attack_interval = base_speed / level
        
        # 3. 쿨타임 체크
        if 'last_attack_time' not in dice_state:
            dice_state['last_attack_time'] = 0
            
        if current_time - dice_state['last_attack_time'] >= attack_interval:
            # 4. 타겟 탐색 (사거리 제한 없음)
            target = self._find_target_front(dice_state, mobs)
            
            if target:
                dice_state['last_attack_time'] = current_time
                dice_state['target_id'] = target['id']
                
                # [NEW] 발사 위치 계산 (눈 위치 순환)
                if 'shot_seq' not in dice_state:
                    dice_state['shot_seq'] = 0
                
                seq = dice_state['shot_seq']
                ox, oy = self._get_pip_offset(level, seq, dice_size)
                
                # 다음 발사를 위해 시퀀스 증가
                dice_state['shot_seq'] = (seq + 1) % level
                
                return {
                    "type": "projectile",
                    "damage": self.data.get('damage', 10), # 기본 데미지
                    "speed": 800, # 투사체 속도
                    "target_id": target['id'],
                    "start_x": dice_state['cx'] + ox,
                    "start_y": dice_state['cy'] + oy
                }
        
        # 타겟 없거나 쿨타임 중일 때 시각적 연결 해제 (짧은 유예 시간)
        if current_time - dice_state['last_attack_time'] > 0.1:
             dice_state['target_id'] = None
             
        return None

    # [수정] 거리 제한 제거 (무조건 앞선 적)
    def _find_target_front(self, dice_state, mobs):
        if not mobs: return None
        
        # path_index가 큰 순서대로 정렬 (가장 멀리 간 적)
        # 동점일 경우 다음 노드까지의 거리가 짧은 순서 등 정밀 계산 가능하나, 일단 index 우선
        sorted_mobs = sorted(mobs, key=lambda m: m['path_index'], reverse=True)
        return sorted_mobs[0]

    # [NEW] 눈 위치 오프셋 계산 (utils.js의 시각적 위치와 동기화)
    def _get_pip_offset(self, level, seq_index, size):
        if level >= 7: return (0, 0) # 7성은 중앙(Star)에서 발사
        
        # 3x3 그리드 기준 오프셋 비율 (중앙 0,0 기준)
        # TL(-0.25, -0.25), TR(0.25, -0.25) ...
        d = size * 0.25 
        
        # 위치 정의
        pos_map = {
            'tl': (-d, -d), 'tc': (0, -d), 'tr': (d, -d),
            'cl': (-d, 0),  'cc': (0, 0),  'cr': (d, 0),
            'bl': (-d, d),  'bc': (0, d),  'br': (d, d)
        }
        
        # 레벨별 눈 배치 순서 (utils.js와 동일하게 맞춤)
        configs = {
            1: ['cc'],
            2: ['tl', 'br'],
            3: ['tl', 'cc', 'br'],
            4: ['tl', 'tr', 'bl', 'br'],
            5: ['tl', 'tr', 'cc', 'bl', 'br'],
            6: ['tl', 'cl', 'bl', 'tr', 'cr', 'br'] # 세로형 2줄
        }
        
        layout = configs.get(level, ['cc'])
        # 안전장치: 시퀀스가 레이아웃 범위 넘어가면 0번으로
        pos_key = layout[seq_index % len(layout)]
        
        return pos_map[pos_key]