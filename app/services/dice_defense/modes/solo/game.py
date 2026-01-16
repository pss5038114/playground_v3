# app/services/dice_defense/modes/solo/game.py

class SoloGameSession:
    def __init__(self):
        self.width = 1080
        self.height = 1920
        self.unit = 140
        
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        # [수정됨] 몬스터 경로 (역 U자 형태 '∩' - 하단 연장)
        # Y=2.5가 그리드 맨 아래 칸의 중심입니다.
        # 시작/끝 지점을 Y=4.0까지 늘려서 그리드 밖으로 길게 뺍니다.
        self.path = [
            {'x': 0.5, 'y': 4.0},  # Start (왼쪽 하단 외부) -> 수정됨(2.5 -> 4.0)
            {'x': 0.5, 'y': -0.5}, # 위로 올라감
            {'x': 6.5, 'y': -0.5}, # 오른쪽으로 이동
            {'x': 6.5, 'y': 4.0},  # End (오른쪽 하단 외부) -> 수정됨(2.5 -> 4.0)
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
        
        # 그리드 셀 크기
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