from ..base import BaseDice

class IronDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "iron",
            "name": "쇠 주사위",
            "grade": "일반",
            "description": "보스 몬스터에게 2배의 강력한 데미지를 입힌다.",
            "icon": "🛡️",
            "color": "slate",
            "target": "Strongest",
            "interval": 1.0,
            "base_atk": 30,
            "class_up_atk": 8,
            "power_up_atk": 15
        })

    def get_base_stats(self, class_lvl: int):
        stats = super().get_base_stats(class_lvl)
        dmg = self.calculate_damage(class_lvl, 1)
        stats.append({"icon": "👑", "name": "보스 피해", "value": f"{dmg*2:.0f}"})
        return stats