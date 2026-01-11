from typing import List, Dict, Optional
from pydantic import BaseModel

# --- 주사위 모듈화를 위한 기본 클래스 (Foundation) ---
class DiceUnit:
    """
    모든 주사위의 부모 클래스.
    각 주사위 파일(예: dice/fire/fire.py)에서 이 클래스를 상속받아 구현.
    """
    def __init__(self, unit_id: str, level: int, power: int):
        self.unit_id = unit_id
        self.level = level # 인게임 눈금 (Dot Count)
        self.power = power # 클래스 강화 레벨
        self.target_priority = "front" # front, rear, random, strong

    def tick(self, context: dict):
        """매 틱마다 호출되어 공격이나 스킬 쿨타임을 처리"""
        pass

    def on_merge(self, other_dice):
        """합쳐질 때 호출"""
        pass

# --- 게임 세션 (V3 규격) ---
class DiceGameSession:
    """
    하나의 게임 룸 상태를 관리하는 클래스.
    Session Manager에 의해 관리됨.
    """
    def __init__(self, session_id: str, players: List[str]):
        self.session_id = session_id
        self.players = players
        self.tick_count = 0
        
        # Core Data Structures
        self.grid: List[Optional[DiceUnit]] = [None] * 15  # 3x5 Grid
        self.sp: int = 100
        
        # Mobs / Objects
        self.mobs_by_id: Dict[str, dict] = {} # 빠른 검색용
        self.mobs_sorted: List[dict] = []     # 타겟팅용 (거리순 정렬)
        
        # Event Queue (Input Handling)
        self.input_queue = []

    def update(self):
        """
        Global Ticker에 의해 1/30초마다 호출되는 메인 루프
        """
        self.tick_count += 1
        
        # 1. Process Inputs (비동기 큐 처리)
        while self.input_queue:
            action = self.input_queue.pop(0)
            self._handle_action(action)
            
        # 2. Update Mobs (Move)
        # 3. Dice Attacks
        # 4. Check Win/Loss Condition

    def _handle_action(self, action):
        """유저 행동 처리 (소환, 합성 등)"""
        pass