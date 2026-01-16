# app/services/dice_defense/modes/solo/game.py

class SoloGameSession:
    def __init__(self):
        # 맵 해상도 (1080x1920)
        self.width = 1080
        self.height = 1920
        
        # 단위 크기 (Unit Size)
        # 가로폭 7유닛 (0~7) -> 1080 / 7 = 약 154px
        # 여유를 두고 140px로 설정
        self.unit = 140
        
        # 맵 시작점 (화면 중앙 정렬을 위한 오프셋)
        # 전체 맵 높이(약 4.5유닛)를 고려하여 세로 중앙 배치
        self.offset_x = (self.width - (7 * self.unit)) // 2  # 가로 중앙
        self.offset_y = (self.height - (5 * self.unit)) // 2 # 세로 중앙 (약간 위쪽?)
        
        # 1. 몬스터 이동 경로 (U자 형태)
        # (0.5, -1) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, -1)
        self.path = [
            {'x': 0.5, 'y': -1.0}, # Start (화면 위)
            {'x': 0.5, 'y': 3.5},  # 좌측 하단 코너
            {'x': 6.5, 'y': 3.5},  # 우측 하단 코너
            {'x': 6.5, 'y': -1.0}, # End (방어선)
        ]
        # 실제 픽셀 좌표로 변환하여 저장
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        # 2. 주사위 배치 그리드 (5x3)
        # x: 1.5 ~ 5.5, y: 0.5 ~ 2.5
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
        
        # 그리드 셀 크기 (유닛보다 약간 작게 해서 간격 둠)
        cell_size = int(self.unit * 0.9)
        
        for r in range(rows):
            for c in range(cols):
                # 논리적 좌표 (1.5, 0.5) 부터 시작
                # Col 1 center = 1.5, Row 1 center = 0.5
                logic_x = 1.5 + c
                logic_y = 0.5 + r
                
                center_pos = self._to_pixel(logic_x, logic_y)
                
                self.grid.append({
                    'index': r * cols + c,
                    'x': center_pos['x'] - cell_size // 2,
                    'y': center_pos['y'] - cell_size // 2,
                    'w': cell_size,
                    'h': cell_size,
                    'cx': center_pos['x'], # 중심좌표 (타게팅용)
                    'cy': center_pos['y'],
                    'dice': None
                })

    def get_map_data(self):
        return {
            "width": self.width,
            "height": self.height,
            "path": self.pixel_path,
            "grid": self.grid
        }