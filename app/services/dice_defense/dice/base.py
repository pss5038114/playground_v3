from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseDice(ABC):
    def __init__(self, config: dict):
        self.config = config
        self.id = config.get("id", "unknown")
        self.name = config.get("name", "Unknown Dice")
        self.grade = config.get("grade", "Common")
        self.description = config.get("description", "")
        # UI 표기용 기본 정보
        self.icon_char = config.get("icon", "🎲")
        self.color = config.get("color", "gray")

    def get_base_stats(self, level: int) -> List[Dict[str, str]]:
        """
        UI 표기용 스탯 리스트를 반환합니다.
        서브클래스에서 super().get_base_stats(level)을 호출 후 추가 스탯을 append 하세요.
        """
        return [
            {
                "icon": "⚔️", 
                "name": "기본 공격력", 
                "value": f"{self.calculate_damage(level):.0f}"
            },
            {
                "icon": "⚡", 
                "name": "공격 속도", 
                "value": f"{self.get_interval(level):.2f}s"
            },
            {
                "icon": "🎯", 
                "name": "타겟", 
                "value": self.config.get("target", "Front")
            }
        ]

    def get_upgrade_preview(self, level: int) -> Dict[str, str]:
        """다음 레벨 업그레이드 시 변경되는 스탯 (UI 팝업용)"""
        curr_dmg = self.calculate_damage(level)
        next_dmg = self.calculate_damage(level + 1)
        return {"공격력": f"+{next_dmg - curr_dmg:.0f}"}

    def get_powerup_preview(self, level: int) -> Dict[str, str]:
        """인게임 파워업 시 변경되는 스탯 (UI 팝업용)"""
        return {"공격력": "+10"} # 기본값

    # --- 인게임 로직 메서드 ---

    def calculate_damage(self, level: int) -> float:
        """레벨에 따른 데미지 계산식"""
        # 기본: 10 + (레벨-1) * 2
        return 10.0 + (level - 1) * 2

    def get_interval(self, level: int) -> float:
        """레벨에 따른 공격 속도 계산식"""
        return self.config.get("interval", 1.0)
    
    # 추후 update(), attack() 등 인게임 로직 메서드 추가 예정