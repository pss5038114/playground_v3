from ..base import BaseDice

class IceDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "ice",
            "name": "얼음 주사위",
            "grade": "일반",
            "description": "공격 받은 적의 이동 속도를 감소시킨다.",
            "icon": "❄️",
            "color": "cyan",
            "target": "Front",
            "interval": 1.2,
            
            # 데미지 설정 (유틸형이라 데미지 낮음)
            "base_atk": 10,
            "class_up_atk": 2,
            "power_up_atk": 4
        })

    def get_base_stats(self, class_lvl: int):
        stats = super().get_base_stats(class_lvl)
        # 슬로우 비율은 고정이라고 가정
        stats.append({"icon": "🐌", "name": "슬로우", "value": "30%"})
        return stats