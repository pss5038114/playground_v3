from ..base import BaseDice

class FireDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "fire",
            "name": "불 주사위",
            "grade": "일반",
            "description": "몬스터 공격 시 타겟 주변에 스플래시 [화염] 데미지를 입힌다.",
            "icon": "🔥",
            "color": "red",
            "target": "Front",
            "interval": 0.8,
            "base_atk": 20,
            "class_up_atk": 5,
            "power_up_atk": 10
        })

    def get_base_stats(self, class_lvl: int):
        stats = super().get_base_stats(class_lvl)
        dmg = self.calculate_damage(class_lvl, 1)
        stats.append({
            "icon": "💥", 
            "name": "화염 피해", 
            "value": f"{dmg:.0f}"
        })
        return stats

    def get_upgrade_preview(self, class_lvl: int):
        base_preview = super().get_upgrade_preview(class_lvl)
        base_preview["화염 피해"] = f"+{self.class_up_atk}"
        return base_preview