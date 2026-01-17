# app/services/dice_defense/entities/base_entity.py
import math

class BaseEntity:
    def __init__(self, data: dict = None):
        self.data = data or {}

    @property
    def default_stats(self):
        """기본 스탯 정의 (자식 클래스에서 오버라이딩)"""
        return {
            "type": "base",
            "hp": 100,
            "max_hp": 100,
            "speed": 100,
            "radius": 20,       # 시각적 크기
            "hitbox_radius": 20 # 피격 판정 크기
        }

    def create_state(self, entity_id: int, start_node: dict):
        stats = self.default_stats
        return {
            "id": entity_id,
            "type": stats["type"],
            "hp": stats["hp"],
            "max_hp": stats["max_hp"],
            "speed": stats["speed"],
            "radius": stats["radius"],
            "hitbox_radius": stats["hitbox_radius"],
            "x": start_node['x'],
            "y": start_node['y'],
            "path_index": 0,
            "finished": False,
            
            # [NEW] 상태 이상 관리용
            "effects": {} 
        }

    def update_move(self, state: dict, path: list, dt: float):
        """
        경로를 따라 이동시키는 로직
        state: 엔티티의 현재 상태 (Mutable)
        path: 픽셀 좌표 경로 리스트
        dt: 델타 타임
        """
        if state['finished']: return

        if state['path_index'] >= len(path) - 1:
            state['finished'] = True
            return

        target = path[state['path_index'] + 1]
        
        # 방향 벡터 및 거리 계산
        dx = target['x'] - state['x']
        dy = target['y'] - state['y']
        dist = math.sqrt(dx**2 + dy**2)
        
        move_dist = state['speed'] * dt
        
        if move_dist >= dist:
            # 목표 도달 -> 다음 웨이포인트로
            state['x'] = target['x']
            state['y'] = target['y']
            state['path_index'] += 1
            
            if state['path_index'] >= len(path) - 1:
                state['finished'] = True
        else:
            # 이동
            state['x'] += (dx / dist) * move_dist
            state['y'] += (dy / dist) * move_dist