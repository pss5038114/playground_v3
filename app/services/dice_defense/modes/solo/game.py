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
        self.offset_x = (self.width - (7 * self.unit)) // 2  # 가로 중앙
        self.offset_y = (self.height - (5 * self.unit)) // 2 # 세로 중앙
        
        # [수정] 몬스터 이동 경로 (역 U자 형태 '∩')
        # Grid Y범위: 0.5 ~ 2.5 (총 3칸)
        # 경로: 왼쪽 아래(Start) -> 왼쪽 위 -> 오른쪽 위 -> 오른쪽 아래(End)
        # 시작/끝 점을 Grid 하단(Y=2.5)과 시각적으로 맞추기 위해 Y=2.5로 설정
        self.path = [
            {'x': 0.5, 'y': 2.5},  # Start (왼쪽 하단, 그리드 높이와 일치)
            {'x': 0.5, 'y': -0.5}, # Corner 1 (왼쪽 상단, 그리드 위로 돌아감)
            {'x': 6.5, 'y': -0.5}, # Corner 2 (오른쪽 상단)
            {'x': 6.5, 'y': 2.5},  # End (오른쪽 하단)
        ]
        
        # 실제 픽셀 좌표로 변환하여 저장
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        # 주사위 배치 그리드 (5x3)
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