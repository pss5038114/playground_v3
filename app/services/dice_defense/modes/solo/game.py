# app/services/dice_defense/modes/solo/game.py
import uuid
import random
import time

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
        
        # 맵 및 그리드 (기존 로직 유지)
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        self.path = [
            {'x': 0.5, 'y': 4.0}, {'x': 0.5, 'y': -0.5}, 
            {'x': 6.5, 'y': -0.5}, {'x': 6.5, 'y': 4.0},
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()
        
        # [NEW] 마지막 업데이트 시간 (Delta Time 계산용)
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

    # [NEW] 게임 루프 (30Hz로 호출됨)
    def update(self):
        current_time = time.time()
        dt = current_time - self.last_update_time
        self.last_update_time = current_time
        
        # 여기에 SP 자동 회복, 몹 이동, 투사체 이동 로직 추가 예정
        # 예: self.sp += 1 * dt (초당 1 SP 회복)
        
        return self.get_broadcast_state()

    # [NEW] 유저 명령 처리 (웹소켓에서 호출)
    def process_command(self, command: dict):
        ctype = command.get('type')
        
        if ctype == 'SPAWN':
            return self._spawn_dice()
        
        # 추후 MERGE, POWER_UP 등 추가
        return None

    def _spawn_dice(self):
        if self.sp < self.spawn_cost:
            return None # 혹은 에러 메시지 리턴
        
        empty_indices = [i for i, cell in enumerate(self.grid) if cell['dice'] is None]
        if not empty_indices:
            return None
        
        target_idx = random.choice(empty_indices)
        dice_id = random.choice(self.deck)
        
        self.grid[target_idx]['dice'] = {
            'id': dice_id,
            'level': 1,
        }
        
        self.sp -= self.spawn_cost
        self.spawn_cost += 10
        
        return True # 상태 변경됨 알림

    # [NEW] 클라이언트 동기화용 경량 데이터
    def get_broadcast_state(self):
        return {
            "type": "STATE_UPDATE",
            "sp": int(self.sp),
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": [cell['dice'] for cell in self.grid] # 전체 그리드 상태 (최적화 가능)
        }

    # 초기 접속 시 전체 데이터 (맵 정보 포함)
    def get_initial_state(self):
        return {
            "type": "INIT",
            "game_id": self.game_id,
            "map": { "width": self.width, "height": self.height, "path": self.pixel_path, "grid": self.grid },
            "state": self.get_broadcast_state()
        }