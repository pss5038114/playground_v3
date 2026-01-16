# app/services/dice_defense/modes/solo/game.py

class SoloGameSession:
    def __init__(self):
        # 맵 크기 (가상 좌표계, 캔버스 비율에 맞춰 설정)
        self.width = 1080
        self.height = 1920
        
        # 1. 몬스터 이동 경로 (Waypoints)
        # (참고 프로젝트의 좌표를 기반으로 하되, 모바일 비율에 맞게 조정)
        self.path = [
            {'x': 100, 'y': -100},   # 시작점 (화면 위)
            {'x': 100, 'y': 400},    # 첫 번째 코너
            {'x': 980, 'y': 400},    # 오른쪽으로 이동
            {'x': 980, 'y': 800},    # 아래로
            {'x': 100, 'y': 800},    # 왼쪽으로
            {'x': 100, 'y': 1200},   # 아래로
            {'x': 980, 'y': 1200},   # 오른쪽으로
            {'x': 980, 'y': 2000},   # 끝점 (화면 아래)
        ]
        
        # 2. 주사위 배치 그리드 (5x3)
        # (중앙 하단부에 배치)
        self.grid = []
        self._init_grid()

    def _init_grid(self):
        rows = 3
        cols = 5
        start_x = 140
        start_y = 1350
        cell_size = 160
        gap = 20
        
        for r in range(rows):
            for c in range(cols):
                self.grid.append({
                    'index': r * cols + c,
                    'x': start_x + c * (cell_size + gap),
                    'y': start_y + r * (cell_size + gap),
                    'w': cell_size,
                    'h': cell_size,
                    'dice': None # 이 자리에 배치된 주사위 객체
                })

    def get_map_data(self):
        """클라이언트에게 보낼 초기 맵 데이터"""
        return {
            "width": self.width,
            "height": self.height,
            "path": self.path,
            "grid": self.grid
        }