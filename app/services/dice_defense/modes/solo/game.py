# app/services/dice_defense/modes/solo/game.py
import random
import logging

# 로깅 설정
logger = logging.getLogger(__name__)

# game_data.py에서 데이터를 가져오되, 실패 시 기본값 사용 (안전장치)
try:
    from app.services.dice_defense.game_data import DICE_DATA
except ImportError:
    logger.warning("DICE_DATA import failed. Using fallback data.")
    DICE_DATA = {
        'fire': {'rarity': 'Common'},
        'electric': {'rarity': 'Common'},
        'wind': {'rarity': 'Common'},
        'ice': {'rarity': 'Rare'},
        'poison': {'rarity': 'Epic'}
    }

class SoloGameSession:
    def __init__(self):
        # 맵 해상도 (1080x1920)
        self.width = 1080
        self.height = 1920
        self.unit = 140
        
        # 맵 시작점 (화면 중앙 정렬)
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2
        
        # 1. 몬스터 이동 경로 (n자 형태)
        self.path = [
            {'x': 0.5, 'y': 4.0},  # Start (좌측 하단)
            {'x': 0.5, 'y': -0.5}, # 좌측 상단으로 이동
            {'x': 6.5, 'y': -0.5}, # 우측 상단으로 이동
            {'x': 6.5, 'y': 4.0},  # 우측 하단 (End)
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        # 2. 게임 상태 데이터
        self.sp = 100
        self.spawn_cost = 10
        self.wave = 1
        self.lives = 3
        self.deck = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        # 3. 주사위 배치 그리드 (5x3)
        self.grid = []
        self._init_grid()

    def _to_pixel(self, ux, uy):
        return {
            'x': int(self.offset_x + ux * self.unit),
            'y': int(self.offset_y + uy * self.unit)
        }

    def _init_grid(self):
        rows = 3
        cols = 5
        cell_size = int(self.unit * 0.9)
        
        for r in range(rows):
            for c in range(cols):
                # 논리적 좌표 (1.5, 0.5) 부터 시작 (경로 안쪽)
                logic_x = 1.5 + c
                logic_y = 0.5 + r
                
                center_pos = self._to_pixel(logic_x, logic_y)
                
                self.grid.append({
                    'index': r * cols + c,
                    'x': center_pos['x'] - cell_size // 2,
                    'y': center_pos['y'] - cell_size // 2,
                    'w': cell_size,
                    'h': cell_size,
                    'dice': None
                })

    def get_map_data(self):
        return {
            "width": self.width,
            "height": self.height,
            "path": self.pixel_path,
            "grid": self.grid
        }

    def get_game_state(self):
        return {
            "sp": self.sp,
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": self.grid
        }

    def process_command(self, cmd_type: str, data: dict = None):
        if cmd_type == "SPAWN":
            return self._spawn_dice()
        return None

    def _spawn_dice(self):
        if self.sp < self.spawn_cost:
            return
        
        empty_slots = [cell for cell in self.grid if cell['dice'] is None]
        if not empty_slots:
            return
        
        self.sp -= self.spawn_cost
        self.spawn_cost += 10
        
        target_slot = random.choice(empty_slots)
        dice_id = random.choice(self.deck)
        
        # 안전한 데이터 접근
        rarity = "Common"
        if DICE_DATA and dice_id in DICE_DATA:
            rarity = DICE_DATA[dice_id].get("rarity", "Common")

        target_slot['dice'] = {
            "id": dice_id,
            "level": 1,
            "power": 1,
            "rarity": rarity
        }

    def update(self):
        pass