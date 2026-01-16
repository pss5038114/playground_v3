# app/services/dice_defense/dice/base_dice.py

import time
import math
from app.services.dice_defense.game_data import DICE_DATA

class BaseDice:
    def __init__(self, dice_id: str, class_level: int, power_level: int = 1):
        """
        :param dice_id: 주사위 ID (예: 'fire')
        :param class_level: 유저의 주사위 클래스 (1 ~ 20)
        :param power_level: 인게임 파워업 레벨 (1 ~ 5, 기본값 1)
        """
        self.dice_id = dice_id
        self.class_level = max(1, class_level)
        self.power_level = max(1, power_level)
        
        # 정적 데이터 로드
        self.static_data = DICE_DATA.get(dice_id, {})
        self.name = self.static_data.get('name', 'Unknown')
        
        # [핵심] 스탯 계산 (game_data 공식 적용)
        self.atk = self._calculate_stat('atk')
        self.speed = self._calculate_stat('speed')
        self.target_type = self.static_data.get('stats', {}).get('target', '앞쪽')
        
        # 전투 상태 관리
        self.last_attack_time = 0
        self.is_active = True # 기절, 해킹 등 상태 이상 시 False

    def _calculate_stat(self, stat_name: str) -> float:
        """
        game_data.py의 {'base': V, 'c': C, 'p': P} 구조를 계산
        공식: Base + (ClassLv-1 * C) + (PowerLv-1 * P)
        """
        stats = self.static_data.get('stats', {})
        stat_info = stats.get(stat_name)

        # 데이터가 없거나 '-'인 경우 (버프 주사위 등)
        if not stat_info or stat_info == '-':
            return 0.0

        base = stat_info.get('base', 0)
        c_inc = stat_info.get('c', 0)
        p_inc = stat_info.get('p', 0)

        # 레벨 보정 (1레벨이 기준이므로 -1)
        val = base + (c_inc * (self.class_level - 1)) + (p_inc * (self.power_level - 1))
        
        # 소수점 2자리 반올림
        return round(val, 2)

    def update_power_level(self, new_level: int):
        """인게임에서 SP로 파워업 했을 때 호출"""
        self.power_level = new_level
        # 스탯 재계산
        self.atk = self._calculate_stat('atk')
        self.speed = self._calculate_stat('speed')

    def can_attack(self, current_time: float) -> bool:
        """공격 가능 여부 체크 (쿨타임)"""
        if not self.is_active or self.speed <= 0:
            return False
        return (current_time - self.last_attack_time) >= self.speed

    def attack(self, target, current_time: float):
        """
        실제 공격 로직 (자식 클래스에서 오버라이딩)
        """
        self.last_attack_time = current_time
        # 기본 로직: 데미지 정보 반환 (투사체 생성 등에 사용)
        return {
            "type": "damage",
            "damage": self.atk,
            "target_id": target.get("id") if target else None,
            "dice_id": self.dice_id
        }

    def get_info(self):
        """디버깅 및 클라이언트 전송용 정보"""
        return {
            "id": self.dice_id,
            "name": self.name,
            "class": self.class_level,
            "power": self.power_level,
            "stats": {
                "atk": self.atk,
                "speed": self.speed
            }
        }