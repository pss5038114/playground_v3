# app/services/dice_defense/modes/solo/game.py
import uuid
import random

class SoloGameSession:
    def __init__(self, user_id: int, deck: list):
        self.game_id = str(uuid.uuid4())
        self.user_id = user_id
        self.deck = deck
        
        # 게임 상태
        self.sp = 100       
        self.spawn_cost = 10 # 초기 소환 비용
        self.lives = 3
        self.wave = 1
        self.is_over = False
        
        # 맵 설정
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        # 경로
        self.path = [
            {'x': 0.5, 'y': 4.0}, {'x': 0.5, 'y': -0.5}, 
            {'x': 6.5, 'y': -0.5}, {'x': 6.5, 'y': 4.0},
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()

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
                    'dice': None # {id: 'fire', level: 1}
                })

    # [NEW] 주사위 소환 로직
    def spawn_dice(self):
        # 1. SP 체크
        if self.sp < self.spawn_cost:
            return {"success": False, "message": "SP가 부족합니다."}
        
        # 2. 빈 자리 찾기
        empty_indices = [i for i, cell in enumerate(self.grid) if cell['dice'] is None]
        if not empty_indices:
            return {"success": False, "message": "빈 자리가 없습니다."}
        
        # 3. 랜덤 위치 & 랜덤 주사위
        target_idx = random.choice(empty_indices)
        dice_id = random.choice(self.deck)
        
        # 4. 그리드 업데이트
        self.grid[target_idx]['dice'] = {
            'id': dice_id,
            'level': 1, # 눈 1개
        }
        
        # 5. 비용 처리
        self.sp -= self.spawn_cost
        self.spawn_cost += 10 # 비용 증가 (공식은 나중에 조정 가능)
        
        return {
            "success": True,
            "new_dice": {
                "index": target_idx,
                "id": dice_id,
                "level": 1
            },
            "state": {
                "sp": self.sp,
                "spawn_cost": self.spawn_cost,
                "lives": self.lives,
                "wave": self.wave
            }
        }

    def get_initial_state(self):
        return {
            "game_id": self.game_id,
            "map": { "width": self.width, "height": self.height, "path": self.pixel_path, "grid": self.grid },
            "state": { "sp": self.sp, "spawn_cost": self.spawn_cost, "lives": self.lives, "wave": self.wave, "deck": self.deck }
        }