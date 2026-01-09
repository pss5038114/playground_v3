from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseDice(ABC):
    def __init__(self, config: dict):
        self.config = config
        self.id = config.get("id", "unknown")
        self.name = config.get("name", "Unknown Dice")
        self.grade = config.get("grade", "Common")
        self.description = config.get("description", "")
        
        # UI 표시용
        self.icon_char = config.get("icon", "🎲")
        self.color = config.get("color", "gray")
        
        # 데미지 공식 상수 (자식 클래스에서 정의)
        self.base_atk = config.get("base_atk", 10)       # 기본 공격력
        self.class_up_atk = config.get("class_up_atk", 2) # 클래스업 당 추가 공격력
        self.power_up_atk = config.get("power_up_atk", 5) # 인게임 파워업 당 추가 공격력

    def calculate_damage(self, class_lvl: int, power_lvl: int = 1) -> float:
        """
        데미지 공식: (기본공격력 + 클래스 업 추가공격력 + 파워 업 추가공격력)
        """
        # 파워업은 인게임 요소이므로, 로비(덱 설정)에서는 power_lvl=1로 계산됨
        dmg = self.base_atk + ((class_lvl - 1) * self.class_up_atk) + ((power_lvl - 1) * self.power_up_atk)
        return float(dmg)

    def get_interval(self, class_lvl: int, power_lvl: int = 1) -> float:
        """공격 속도 (기본적으로 변화 없음, 필요시 오버라이딩)"""
        return self.config.get("interval", 1.0)

    # --- UI 데이터 제공 메서드 ---

    def get_base_stats(self, class_lvl: int) -> List[Dict[str, str]]:
        """팝업 및 인벤토리 상세 정보"""
        dmg = self.calculate_damage(class_lvl, 1) # 로비 기준(파워업 1)
        
        return [
            {
                "icon": "⚔️", 
                "name": "공격력", 
                "value": f"{dmg:.0f}"
            },
            {
                "icon": "⚡", 
                "name": "공격 속도", 
                "value": f"{self.get_interval(class_lvl):.2f}s"
            },
            {
                "icon": "🎯", 
                "name": "타겟", 
                "value": self.config.get("target", "Front")
            }
        ]

    def get_upgrade_preview(self, class_lvl: int) -> Dict[str, str]:
        """[클래스 업] 버튼 클릭 시 예상 변화값"""
        # 공격력 차이 계산
        curr = self.calculate_damage(class_lvl, 1)
        next_val = self.calculate_damage(class_lvl + 1, 1)
        diff = next_val - curr
        
        return {
            "공격력": f"+{diff:.0f}"
        }

    def get_powerup_preview(self, class_lvl: int) -> Dict[str, str]:
        """[파워 업] 버튼 클릭 시 예상 변화값"""
        # 파워업 1 -> 2 상승 시 공격력 차이
        return {
            "공격력": f"+{self.power_up_atk}"
        }