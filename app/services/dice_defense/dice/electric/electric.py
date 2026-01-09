from ..base import BaseDice

class ElectricDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "electric",
            "name": "전기 주사위",
            "grade": "일반",
            "description": "공격 시 최대 3마리의 적에게 전이되는 [전기] 데미지를 입힌다.",
            "icon": "⚡",
            "color": "yellow",
            "target": "Front",
            "interval": 0.7,
            "base_atk": 15,
            "class_up_atk": 4,
            "power_up_atk": 8
        })

    def get_base_stats(self, class_lvl: int):
        stats = super().get_base_stats(class_lvl)
        stats.append({"icon": "🔗", "name": "최대 타겟", "value": "3"})
        return stats