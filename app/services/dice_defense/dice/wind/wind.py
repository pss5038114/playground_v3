from ..base import BaseDice

class WindDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "wind",
            "name": "바람 주사위",
            "grade": "일반",
            "description": "변신 모드 시 공격 속도가 극도로 빨라진다. (현재는 기본 공속이 빠름)",
            "icon": "🍃",
            "color": "green",
            "target": "Front",
            "interval": 0.6,
            "base_atk": 8,
            "class_up_atk": 2,
            "power_up_atk": 5
        })

    def get_interval(self, class_lvl: int, power_lvl: int = 1) -> float:
        base_interval = self.config["interval"]
        reduction = (class_lvl - 1) * 0.01
        return max(0.3, base_interval - reduction)

    def get_upgrade_preview(self, class_lvl: int):
        preview = super().get_upgrade_preview(class_lvl)
        preview["공격 속도"] = "-0.01s"
        return preview