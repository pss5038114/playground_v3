# app/services/dice_defense/modes/solo/game.py
import random
from app.services.dice_defense.game_data import DICE_DATA

class SoloGameSession:
    def __init__(self):
        # 맵 해상도 (1080x1920)
        self.width = 1080
        self.height = 1920
        
        # 단위 크기 (Unit Size)
        self.unit = 140
        
        # 맵 시작점 (화면 중앙 정렬)
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2
        
        # [변경] 1. 몬스터 이동 경로 (n자 형태)
        # 시작(좌측하단) -> 위 -> 오른쪽 -> 아래(우측하단)
        # Grid Y range: 0.5 ~ 2.5 (3 rows)
        self.path = [
            {'x': 0.5, 'y': 4.0},  # Start (좌측 하단 외부)
            {'x': 0.5, 'y': -0.5}, # 좌측 상단 코너
            {'x': 6.5, 'y': -0.5}, # 우측 상단 코너
            {'x': 6.5, 'y': 4.0},  # End (우측 하단 외부)
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        # 2. 게임 상태 데이터
        self.sp = 100            # 초기 SP
        self.spawn_cost = 10     # 초기 소환 비용
        self.wave = 1
        self.lives = 3
        
        # 임시 덱 (추후 유저 덱 연동 필요)
        self.deck = ['fire', 'electric', 'wind', 'ice', 'poison']
        
        # 3. 주사위 배치 그리드 (5x3)
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
                # 논리적 좌표 (1.5, 0.5) 부터 시작
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
                    'dice': None # {id: 'fire', class: 1, power: 1} 형태
                })

    def get_map_data(self):
        """클라이언트 초기화용 맵 데이터"""
        return {
            "width": self.width,
            "height": self.height,
            "path": self.pixel_path,
            "grid": self.grid
        }

    def get_game_state(self):
        """실시간 동기화용 게임 상태"""
        return {
            "sp": self.sp,
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": self.grid # 주사위 배치 상태 포함
        }

    def process_command(self, cmd_type: str, data: dict = None):
        """클라이언트 명령 처리"""
        if cmd_type == "SPAWN":
            return self._spawn_dice()
        return None

    def _spawn_dice(self):
        # 1. 비용 체크
        if self.sp < self.spawn_cost:
            return {"success": False, "message": "SP 부족"}
        
        # 2. 빈 슬롯 찾기
        empty_slots = [cell for cell in self.grid if cell['dice'] is None]
        if not empty_slots:
            return {"success": False, "message": "공간 부족"}
        
        # 3. SP 차감 및 비용 증가
        self.sp -= self.spawn_cost
        self.spawn_cost += 10 # 소환할 때마다 비용 10 증가
        
        # 4. 랜덤 주사위 선택 및 배치
        target_slot = random.choice(empty_slots)
        dice_id = random.choice(self.deck)
        
        target_slot['dice'] = {
            "id": dice_id,
            "level": 1, # 인게임 눈금 (dot count)
            "power": 1, # 파워업 레벨
            "rarity": DICE_DATA.get(dice_id, {}).get("rarity", "Common") # 렌더링용
        }
        
        return {"success": True, "sp": self.sp, "spawn_cost": self.spawn_cost}

    def update(self):
        # 게임 루프 (몬스터 이동, 공격 등 추후 구현)
        pass