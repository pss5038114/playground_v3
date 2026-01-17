# app/services/dice_defense/modes/solo/game.py
import uuid
import random
import time
import math # 거리 계산용
from app.services.dice_defense.dice import get_dice_logic # [NEW]

class SoloGameSession:
    def __init__(self, user_id: int, deck: list):
        self.game_id = str(uuid.uuid4())
        self.user_id = user_id
        self.deck = deck
        
        # 게임 상태
        self.sp = 100       
        self.spawn_cost = 10
        self.lives = 3
        self.wave = 1
        
        # [NEW] 몹 관련 상태
        self.mobs = [] # 몹 객체 리스트
        self.mob_id_counter = 0
        self.last_spawn_time = time.time()
        self.spawn_interval = 1.0 # 1초마다 스폰
        
        # 맵 설정
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        # 경로 (U자 형태)
        self.path = [
            {'x': 0.5, 'y': 4.0}, {'x': 0.5, 'y': -0.5}, 
            {'x': 6.5, 'y': -0.5}, {'x': 6.5, 'y': 4.0},
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()
        
        self.last_update_time = time.time()

    def _to_pixel(self, ux, uy):
        return { 'x': self.offset_x + ux * self.unit, 'y': self.offset_y + uy * self.unit }

    def _init_grid(self):
        rows, cols = 3, 5
        cell_size = int(self.unit * 0.9)
        for r in range(rows):
            for c in range(cols):
                logic_x, logic_y = 1.5 + c, 0.5 + r
                center_pos = self._to_pixel(logic_x, logic_y)
                self.grid.append({
                    'index': r * cols + c,
                    'x': center_pos['x'] - cell_size // 2,
                    'y': center_pos['y'] - cell_size // 2,
                    'w': cell_size,
                    'h': cell_size,
                    'cx': center_pos['x'],
                    'cy': center_pos['y'],
                    'dice': None 
                })

    # [수정] 게임 루프 (30Hz)
    def update(self):
        current_time = time.time()
        dt = current_time - self.last_update_time
        self.last_update_time = current_time
        
        # 1. 몹 스폰 (1초 주기)
        if current_time - self.last_spawn_time >= self.spawn_interval:
            self._spawn_mob()
            self.last_spawn_time = current_time
            
        # 2. 몹 이동 처리
        active_mobs = []
        for mob in self.mobs:
            reached_end = self._move_mob(mob, dt)
            if reached_end:
                self.lives -= 1 # 라이프 감소
                # 라이프가 0 이하가 되어도 게임은 계속 진행 (요청사항)
            else:
                active_mobs.append(mob)
        
        self.mobs = active_mobs
        
        # 상태 변경이 있을 때만 보내는 최적화는 추후 적용 (지금은 매 틱 전송)
        return self.get_broadcast_state()

    # [NEW] 몹 생성
    def _spawn_mob(self):
        start_node = self.pixel_path[0]
        self.mob_id_counter += 1
        
        new_mob = {
            'id': self.mob_id_counter,
            'hp': 100,
            'max_hp': 100,
            'speed': 300, # 픽셀/초 (속도 조절 가능)
            'path_index': 0, # 현재 출발한 웨이포인트 인덱스
            'x': start_node['x'],
            'y': start_node['y'],
            'frozen': 0, 
        }
        self.mobs.append(new_mob)

    # [NEW] 몹 이동
    def _move_mob(self, mob, dt):
        # 마지막 경로면 도착 처리
        if mob['path_index'] >= len(self.pixel_path) - 1:
            return True 

        # 다음 목표 지점
        target = self.pixel_path[mob['path_index'] + 1]
        
        # 방향 벡터 및 거리 계산
        dx = target['x'] - mob['x']
        dy = target['y'] - mob['y']
        dist = math.sqrt(dx**2 + dy**2)
        
        move_dist = mob['speed'] * dt
        
        if move_dist >= dist:
            # 목표 도달 -> 좌표를 목표로 맞추고 다음 인덱스로
            mob['x'] = target['x']
            mob['y'] = target['y']
            mob['path_index'] += 1
            
            # 남은 이동 거리만큼 더 이동시키는 로직은 생략 (단순화)
            if mob['path_index'] >= len(self.pixel_path) - 1:
                return True # 끝 도달
        else:
            # 목표를 향해 이동
            mob['x'] += (dx / dist) * move_dist
            mob['y'] += (dy / dist) * move_dist
            
        return False

    def process_command(self, command: dict):
        ctype = command.get('type')
        
        if ctype == 'SPAWN':
            return self._spawn_dice()
        
        elif ctype == 'MERGE':
            return self._handle_merge(command)
            
        return None
    
    # [NEW] 결합 처리 로직
    def _handle_merge(self, command):
        src_idx = command.get('source_index')
        tgt_idx = command.get('target_index')
        
        if src_idx is None or tgt_idx is None: return None
        if src_idx == tgt_idx: return None # 자기 자신과 결합 불가
        
        # 그리드 범위 확인
        if not (0 <= src_idx < len(self.grid)) or not (0 <= tgt_idx < len(self.grid)):
            return None

        src_cell = self.grid[src_idx]
        tgt_cell = self.grid[tgt_idx]
        
        src_dice = src_cell['dice']
        tgt_dice = tgt_cell['dice']
        
        if not src_dice or not tgt_dice: return None # 빈 칸 결합 불가
        
        # 1. 소스 주사위의 로직 객체 가져오기
        logic = get_dice_logic(src_dice['id'])
        
        # 2. 결합 가능 여부 확인 (전략 패턴)
        if logic.can_merge_with(src_dice, tgt_dice):
            # 3. 결합 실행 (결과물 생성)
            new_dice_state = logic.on_merge(src_dice, tgt_dice, self.deck)
            
            # 4. 그리드 업데이트
            # 타겟 위치에 새로운 주사위 배치
            self.grid[tgt_idx]['dice'] = new_dice_state
            # 소스 위치는 비움
            self.grid[src_idx]['dice'] = None
            
            return True # 상태 변경됨 -> 브로드캐스트 트리거
            
        return None

    def _spawn_dice(self):
        if self.sp < self.spawn_cost: return None
        
        empty_indices = [i for i, cell in enumerate(self.grid) if cell['dice'] is None]
        if not empty_indices: return None
        
        target_idx = random.choice(empty_indices)
        dice_id = random.choice(self.deck)
        
        self.grid[target_idx]['dice'] = { 'id': dice_id, 'level': 1 }
        
        self.sp -= self.spawn_cost
        self.spawn_cost += 10
        return True

    def get_broadcast_state(self):
        return {
            "type": "STATE_UPDATE",
            "sp": int(self.sp),
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": [cell['dice'] for cell in self.grid],
            "mobs": self.mobs # [NEW] 몹 정보 전송
        }

    def get_initial_state(self):
        return {
            "type": "INIT",
            "game_id": self.game_id,
            "map": { "width": self.width, "height": self.height, "path": self.pixel_path, "grid": self.grid },
            "state": self.get_broadcast_state()
        }