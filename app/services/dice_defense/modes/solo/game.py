# app/services/dice_defense/modes/solo/game.py

class SoloGameSession:
    def __init__(self):
        # 맵 해상도 (1080x1920 기준)
        self.width = 1080
        self.height = 1920
        
        # --- 맵 설정 (사용자 요청: 7x4 그리드) ---
        self.cols = 7
        self.rows = 4
        
        # 그리드 하나의 크기와 간격 (픽셀 단위)
        # 화면 너비 1080에서 좌우 여백을 빼고 7등분
        # 대략 셀 크기 130px, 간격 10px 정도면 적당
        self.cell_size = 130 
        self.gap = 10
        
        # 그리드 시작 위치 (화면 중앙 하단)
        # 전체 그리드 너비 = (130+10)*7 - 10 = 970
        # 좌우 여백 = (1080 - 970) / 2 = 55
        self.start_x = 55
        self.start_y = 1000 # 화면 중간 아래부터 시작
        
        # 1. 몬스터 이동 경로 (논리 좌표 -> 픽셀 좌표 변환)
        # 논리 좌표: (x, y) -> 실제: start_x + x * (size+gap), start_y + (3-y) * (size+gap)
        # 주의: 사용자가 "왼쪽 아래가 0,0"이라고 했으므로, y축을 뒤집어서 계산해야 함 (화면은 위가 0)
        
        waypoints = [
            (0.5, -1),   # 시작점 (화면 밖 아래에서 진입 느낌 or 0에서 시작) -> 요청: 0.5, 0에서 시작
            (0.5, 3.5),  # 위로 이동 (첫 번째 코너)
            (6.5, 3.5),  # 오른쪽으로 이동 (두 번째 코너)
            (6.5, -1)    # 아래로 이동 (방어선 통과)
        ]
        
        self.path = []
        for wx, wy in waypoints:
            px, py = self._to_pixel(wx, wy)
            self.path.append({'x': px, 'y': py})
            
        # 2. 주사위 배치 그리드 (7x4)
        self.grid = []
        self._init_grid()

    def _to_pixel(self, lx, ly):
        """논리 좌표(Logic X, Y)를 픽셀 좌표로 변환"""
        # x는 그대로 증가
        px = self.start_x + lx * (self.cell_size + self.gap)
        
        # y는 '왼쪽 아래'가 0이므로, 화면상에서는 아래쪽(큰 값)이 0이어야 함.
        # rows=4 이므로, y=0은 index 3번째 줄, y=3은 index 0번째 줄
        # 즉, 화면 y = start_y + (max_row - 1 - ly) * size... 가 아니라
        # 간단하게: 기준점(맨 아래)에서 위로 올라가는 식으로 계산
        
        # 그리드의 맨 아래쪽 Y 좌표 (y=0 인 라인)
        grid_bottom_y = self.start_y + (self.rows - 1) * (self.cell_size + self.gap)
        
        # 거기서 ly만큼 위로(-) 이동
        py = grid_bottom_y - ly * (self.cell_size + self.gap)
        
        return int(px), int(py)

    def _init_grid(self):
        # 7x4 그리드 생성
        # 순서는 (0,0) -> (1,0) ... -> (6,0) -> (0,1) ... (왼쪽 아래부터 채우기?)
        # 보통 인덱스는 0~27까지 순차적으로 부여
        for r in range(self.rows): # 0, 1, 2, 3 (화면 위에서 아래로)
            for c in range(self.cols):
                # 논리적 y좌표 (화면 아래가 0이므로 역순)
                logic_y = self.rows - 1 - r
                logic_x = c
                
                px, py = self._to_pixel(logic_x, logic_y)
                
                self.grid.append({
                    'index': r * self.cols + c, # 0~27 (단, 배치는 위에서부터 될 수 있음)
                    'x': px - self.cell_size / 2, # 중심 좌표에서 좌상단으로 변환 (그리기용)
                    'y': py - self.cell_size / 2,
                    'cx': px, # 중심점 (투사체 발사 원점)
                    'cy': py,
                    'w': self.cell_size,
                    'h': self.cell_size,
                    'logic_x': logic_x,
                    'logic_y': logic_y,
                    'dice': None
                })

    def get_map_data(self):
        return {
            "width": self.width,
            "height": self.height,
            "path": self.path,
            "grid": self.grid
        }