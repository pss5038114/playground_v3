# app/services/dice_defense/modes/solo/game.py
import uuid

class SoloGameSession:
    def __init__(self, user_id: int, deck: list):
        self.game_id = str(uuid.uuid4())
        self.user_id = user_id
        self.deck = deck  # ['fire', 'ice', ...] (주사위 ID 리스트)
        
        # 게임 상태 초기화
        self.sp = 100       # 초기 SP
        self.lives = 3      # 초기 라이프
        self.wave = 1       # 현재 웨이브
        self.is_over = False
        
        # 맵 설정 (기존 코드 유지)
        self.width = 1080
        self.height = 1920
        self.unit = 140
        
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        # 몬스터 경로 (역 U자 형태)
        self.path = [
            {'x': 0.5, 'y': 4.0},  # Start
            {'x': 0.5, 'y': -0.5}, 
            {'x': 6.5, 'y': -0.5}, 
            {'x': 6.5, 'y': 4.0},  # End
        ]
        
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()

    def _to_pixel(self, ux, uy):
        return {
            'x': self.offset_x + ux * self.unit,
            'y': self.offset_y + uy * self.unit
        }

    def _init_grid(self):
        rows = 3
        cols = 5
        cell_size = int(self.unit * 0.9)
        
        for r in range(rows):
            for c in range(cols):
                logic_x = 1.5 + c
                logic_y = 0.5 + r
                center_pos = self._to_pixel(logic_x, logic_y)
                
                self.grid.append({
                    'index': r * cols + c,
                    'x': center_pos['x'] - cell_size // 2,
                    'y': center_pos['y'] - cell_size // 2,
                    'w': cell_size,
                    'h': cell_size,
                    'cx': center_pos['x'],
                    'cy': center_pos['y'],
                    'dice': None # 여기에 배치된 주사위 정보가 들어갈 예정
                })

    def get_initial_state(self):
        """클라이언트에게 보낼 초기 게임 데이터"""
        return {
            "game_id": self.game_id,
            "map": {
                "width": self.width,
                "height": self.height,
                "path": self.pixel_path,
                "grid": self.grid
            },
            "state": {
                "sp": self.sp,
                "lives": self.lives,
                "wave": self.wave,
                "deck": self.deck # 덱에 포함된 주사위 ID 목록
            }
        }