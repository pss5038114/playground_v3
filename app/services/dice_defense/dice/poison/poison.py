from ..base import BaseDice

class PoisonDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "poison",
            "name": "독 주사위",
            "grade": "일반",
            "description": "적을 중독시켜 5초간 지속적인 [독] 데미지를 입힌다.",
            "icon": "☠️",
            "color": "purple",
            "target": "Front",
            "interval": 1.0,
            
            # 데미지 설정 (도트 데미지 기준)
            "base_atk": 12,
            "class_up_atk": 3,
            "power_up_atk": 6
        })

    def get_base_stats(self, class_lvl: int):
        stats = super().get_base_stats(class_lvl)
        dmg = self.calculate_damage(class_lvl, 1)
        stats.append({"icon": "🧪", "name": "독 피해/초", "value": f"{dmg:.0f}"})
        stats.append({"icon": "⏱️", "name": "지속 시간", "value": "5s"})
        return stats
    
    def get_upgrade_preview(self, class_lvl: int):
        base = super().get_upgrade_preview(class_lvl)
        base["독 피해"] = f"+{self.class_up_atk}"
        return base