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
        
        # 보드 행 개수 (세로 4칸 기준) - 좌표 반전을 위해 필요
        self.board_rows = 4
        
        # 맵 시작점 (화면 중앙 정렬을 위한 오프셋)
        self.offset_x = (self.width - (7 * self.unit)) // 2 
        self.offset_y = (self.height - (self.board_rows * self.unit)) // 2 
        
        # 1. 몬스터 이동 경로 (역 U자 / n자 형태)
        # 좌표계 기준: 좌하단이 (0,0)
        # Start(0.5, 0) -> Up(0.5, 3.5) -> Right(6.5, 3.5) -> Down(6.5, 0)
        self.path = [
            {'x': 0.5, 'y': 0.0}, 
            {'x': 0.5, 'y': 3.5},  
            {'x': 6.5, 'y': 3.5},  
            {'x': 6.5, 'y': 0.0}, 
        ]
        # 실제 픽셀 좌표로 변환하여 저장
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        # 2. 주사위 배치 그리드 (5x3)
        self.grid = []
        self._init_grid()

    def _to_pixel(self, ux, uy):
        """
        논리 좌표(ux, uy)를 픽셀 좌표로 변환
        - ux: 0 ~ 7 (Left -> Right)
        - uy: 0 ~ 4 (Bottom -> Top)
        """
        return {
            'x': self.offset_x + ux * self.unit,
            # Y축 반전: Canvas는 위쪽이 0이므로, (전체높이 - uy)로 계산
            'y': self.offset_y + (self.board_rows - uy) * self.unit
        }

    def _init_grid(self):
        rows = 3
        cols = 5
        
        # 그리드 셀 크기
        cell_size = int(self.unit * 0.9)
        
        for r in range(rows):
            for c in range(cols):
                # 논리적 좌표 계산
                # Grid 시작점 (1, 0) + 셀 중심(0.5)
                logic_x = 1.0 + c + 0.5
                logic_y = 0.0 + r + 0.5
                
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