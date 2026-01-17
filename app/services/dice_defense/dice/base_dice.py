# app/services/dice_defense/dice/base_dice.py
import math
import random

class BaseDice:
    def __init__(self, dice_id: str, data: dict):
        self.id = dice_id
        self.data = data # game_data.py 정보

    # -------------------------------------------------------------
    # [1] 타게팅 로직 (Target Selection)
    # -------------------------------------------------------------
    def find_target(self, dice_state: dict, mobs: list):
        """기본: 최전방 타게팅 전략 사용"""
        return self._target_front(dice_state, mobs)

    def _target_front(self, dice_state, mobs):
        """전략: 가장 앞서가는 적 선택"""
        if not mobs: return None
        # path_index가 큰 순서 = 결승점에 가까운 순서
        sorted_mobs = sorted(mobs, key=lambda m: m['path_index'], reverse=True)
        return sorted_mobs[0]

    # -------------------------------------------------------------
    # [2] 발사 로직 (Firing Mechanism)
    # -------------------------------------------------------------
    def create_projectiles(self, dice_state: dict, target: dict, dice_size: int = 100):
        """기본: 눈 위치 순환 발사 전략 사용"""
        return self._fire_sequential(dice_state, target, dice_size)

    def _fire_sequential(self, dice_state, target, dice_size):
        """전략: 눈 하나하나 순차적으로 1발씩 발사"""
        level = dice_state['level']
        
        # 발사 위치 계산 (offset)
        if 'shot_seq' not in dice_state: dice_state['shot_seq'] = 0
        seq = dice_state['shot_seq']
        
        ox, oy = self._get_pip_offset(level, seq, dice_size)
        
        # 다음 발사를 위해 시퀀스 증가
        dice_state['shot_seq'] = (seq + 1) % level
        
        return [{
            "type": "projectile",
            "dice_id": self.id,      # [중요] 피격 시 로직 찾기 위함
            "damage": self.data.get('damage', 10),
            "speed": 800,
            "target_id": target['id'],
            "start_x": dice_state['cx'] + ox,
            "start_y": dice_state['cy'] + oy
        }]

    # -------------------------------------------------------------
    # [3] 데미지 로직 (On Hit Effect)
    # -------------------------------------------------------------
    def on_hit(self, target: dict, projectile: dict, mobs: list):
        """기본: 단일 타겟 데미지"""
        self._damage_single(target, projectile)

    def _damage_single(self, target, projectile):
        """전략: 타겟 하나에게 정직하게 데미지 적용"""
        damage = projectile['damage']
        target['hp'] -= damage

    # -------------------------------------------------------------
    # [유틸리티] (공통 기능)
    # -------------------------------------------------------------
    def update_attack(self, dice_state: dict, mobs: list, dt: float, current_time: float, dice_size: int = 100):
        """쿨타임 관리 및 [1]->[2] 실행 오케스트레이터"""
        base_speed = self.data.get('speed', 1.0)
        level = dice_state['level']
        attack_interval = base_speed / level # 공격 속도 공식
        
        if 'last_attack_time' not in dice_state: dice_state['last_attack_time'] = 0
            
        if current_time - dice_state['last_attack_time'] >= attack_interval:
            # [1] 타겟 선정
            target = self.find_target(dice_state, mobs)
            
            if target:
                dice_state['last_attack_time'] = current_time
                dice_state['target_id'] = target['id']
                
                # [2] 투사체 생성
                return self.create_projectiles(dice_state, target, dice_size)
        
        # 시각적 타겟 라인 해제 (짧은 유예)
        if current_time - dice_state['last_attack_time'] > 0.1:
             dice_state['target_id'] = None
        return None

    def _get_pip_offset(self, level, seq_index, size):
        if level >= 7: return (0, 0)
        d = size * 0.25 
        pos_map = {
            'tl': (-d, -d), 'tc': (0, -d), 'tr': (d, -d),
            'cl': (-d, 0),  'cc': (0, 0),  'cr': (d, 0),
            'bl': (-d, d),  'bc': (0, d),  'br': (d, d)
        }
        configs = {
            1: ['cc'], 2: ['tl', 'br'], 3: ['tl', 'cc', 'br'],
            4: ['tl', 'tr', 'bl', 'br'], 5: ['tl', 'tr', 'cc', 'bl', 'br'],
            6: ['tl', 'cl', 'bl', 'tr', 'cr', 'br']
        }
        layout = configs.get(level, ['cc'])
        return pos_map[layout[seq_index % len(layout)]]

    # 결합 관련 (기존 유지)
    def can_merge_with(self, my_state: dict, target_state: dict) -> bool:
        if not target_state: return False
        return (self.id == target_state['id'] and my_state['level'] == target_state['level'])

    def on_merge(self, my_state: dict, target_state: dict, deck: list) -> dict:
        new_level = my_state['level'] + 1
        if new_level > 7: new_level = 7
        new_id = random.choice(deck)
        return {'id': new_id, 'level': new_level}