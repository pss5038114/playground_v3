# app/services/dice_defense/modes/solo/game.py

class SoloGameSession:
    def __init__(self):
        self.width = 1080
        self.height = 1920
        self.unit = 140
        
        self.offset_x = (self.width - (7 * self.unit)) // 2  
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        # 1. 몬스터 경로 (상하반전 수정됨)
        # 0.5, 0.5(그리드 첫칸 y)를 기준으로 위쪽이 y가 작아짐
        # Path: Start(위) -> (0.5, 0.5) [상단좌측] -> (0.5, 3.5) [하단좌측] -> (6.5, 3.5) [하단우측] -> (6.5, 0.5) [상단우측] -> End(위)
        # 아, 사용자님 요청은: (0.5, 0) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, 0)
        # 0이 위쪽, 3.5가 아래쪽이라고 가정하면 이게 맞습니다. (Canvas y는 아래로 갈수록 커짐)
        
        # Grid Center Y: 0.5, 1.5, 2.5 (3줄)
        # Path는 Grid(0.5~2.5)를 감싸야 하므로
        # 좌측 라인 x=0.5, 우측 라인 x=6.5
        # 상단 y= -1 (시작점), 하단 y=3.5 (도는 구간)
        
        self.path = [
            {'x': 0.5, 'y': -1.0}, # Start (위에서 시작)
            {'x': 0.5, 'y': 3.5},  # 좌측 라인 타고 아래로 (Turn Point 1)
            {'x': 6.5, 'y': 3.5},  # 오른쪽으로 이동 (Turn Point 2)
            {'x': 6.5, 'y': -1.0}, # 위로 올라가서 끝 (Defense Line)
        ]
        
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
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