from typing import List, Dict

class SoloGameLogic:
    def __init__(self):
        # 1. 그리드 설정 (7x4)
        self.width = 7
        self.height = 4
        
        # 2. 몬스터 경로 (좌측 하단 진입 -> 위 -> 오른쪽 -> 우측 하단 탈출)
        # 좌표는 그리드 셀의 중심점(0.5 단위) 기준입니다.
        self.path = [
            {"x": 0.5, "y": 0.0},   # START: 0번 컬럼 하단 끝
            {"x": 0.5, "y": 3.5},   # CORNER 1: 0번 컬럼 상단 (3번 row 중심)
            {"x": 6.5, "y": 3.5},   # CORNER 2: 6번 컬럼 상단 (3번 row 중심)
            {"x": 6.5, "y": 0.0}    # END: 6번 컬럼 하단 끝
        ]

        # 3. 주사위 배치 가능 구역 (5x3)
        # x: 1~5 (총 5칸), y: 0~2 (총 3칸)
        self.dice_slots = {} # (x, y) -> DiceObject
        
        # 게임 상태 데이터
        self.sp = 100
        self.wave = 1
        self.monsters = []

    def is_valid_slot(self, x: int, y: int) -> bool:
        """
        주사위를 놓을 수 있는 5x3 영역인지 확인
        x: 1 ~ 5
        y: 0 ~ 2
        """
        return 1 <= x <= 5 and 0 <= y <= 2

    def spawn_dice(self, user_id: str):
        # TODO: 실제 소환 로직 (빈 슬롯 찾기 -> 주사위 생성 -> SP 차감)
        pass