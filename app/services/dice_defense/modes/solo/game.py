import random
from app.services.dice_defense.game_data import DICE_DATA

# 맵 경로 데이터 (기존 데이터 유지)
SOLO_MAP_PATH = [
    {"x": 100, "y": 100}, {"x": 100, "y": 500}, 
    {"x": 500, "y": 500}, {"x": 500, "y": 100},
    {"x": 900, "y": 100}, {"x": 900, "y": 800}
]

# 그리드 좌표 (기존 데이터 유지 - 5x3 예시)
GRID_POSITIONS = []
for r in range(3):
    for c in range(5):
        GRID_POSITIONS.append({"x": 200 + c * 150, "y": 1000 + r * 150})

class SoloGameLogic:
    """
    솔로 모드의 게임 상태(State)를 관리하는 순수 로직 클래스.
    WebSocket 연결 여부와 관계없이 게임 데이터만 처리합니다.
    """
    def __init__(self):
        # 15칸의 그리드 (0~14 인덱스), None이면 빈칸
        # 포맷: {"id": "1001", "level": 1, "power": 0}
        self.grid = [None] * 15 
        
        # 재화 및 비용
        self.sp = 100         # 초기 SP
        self.sp_cost = 10     # 초기 소환 비용
        
        # 웨이브 정보
        self.wave = 1
        self.monsters = []    # 현재 필드에 있는 몬스터 목록

    def spawn_dice(self, user_id: str):
        """
        주사위 소환 로직
        1. SP 확인
        2. 빈칸 확인
        3. 랜덤 주사위 선택
        4. 그리드 배치 및 SP 차감
        """
        # 1. SP 부족 체크
        if self.sp < self.sp_cost:
            return {"success": False, "message": "SP가 부족합니다."}

        # 2. 빈칸 찾기
        empty_indices = [i for i, cell in enumerate(self.grid) if cell is None]
        if not empty_indices:
            return {"success": False, "message": "빈 공간이 없습니다."}

        # 3. 비용 차감 및 비용 증가 (선형 증가 예시 +10)
        self.sp -= self.sp_cost
        self.sp_cost += 10

        # 4. 랜덤 위치 및 주사위 결정
        target_idx = random.choice(empty_indices)
        
        # 구현된 주사위 ID 목록 (game_data.py의 키값 활용)
        available_dice_ids = list(DICE_DATA.keys())
        if not available_dice_ids:
            return {"success": False, "message": "데이터 오류: 소환 가능한 주사위가 없습니다."}
            
        selected_dice_id = random.choice(available_dice_ids)

        # 5. 그리드 업데이트
        new_dice = {
            "id": selected_dice_id,
            "level": 1,       # 눈금 (Dot count)
            "power": 0,       # 인게임 강화 레벨
            "target_idx": target_idx
        }
        self.grid[target_idx] = new_dice

        # 6. 변경된 상태 리턴 (브로드캐스팅용)
        return {
            "type": "GRID_UPDATE",
            "success": True,
            "grid": self.grid,
            "sp": self.sp,
            "sp_cost": self.sp_cost
        }

    def update(self):
        """
        매 틱(Tick)마다 호출되는 게임 루프.
        몬스터 이동, 공격 쿨타임 감소 등을 처리.
        """
        # TODO: 몬스터 이동 및 공격 로직 구현 예정
        pass

    def get_state(self):
        """현재 전체 게임 상태 반환 (중도 난입 유저 동기화용)"""
        return {
            "type": "GRID_UPDATE",
            "grid": self.grid,
            "sp": self.sp,
            "sp_cost": self.sp_cost,
            "wave": self.wave
        }