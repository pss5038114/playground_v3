from ..base import BaseDice

class FireDice(BaseDice):
    def __init__(self):
        super().__init__({
            "id": "fire",
            "name": "불 주사위",
            "grade": "일반",
            "description": "몬스터 공격 시 타겟 주변에 스플래시 [화염] 데미지를 입힌다.",
            "interval": 0.8,
            "target": "Front",
            "icon": "🔥",
            "color": "red"
        })

    def calculate_damage(self, level: int) -> float:
        # 공식: 20 + (Lv-1)*5
        return 20.0 + (level - 1) * 5.0

    def get_interval(self, level: int) -> float:
        # 공식: 0.8 - (Lv-1)*0.01 (최소 0.2)
        return max(0.2, 0.8 - (level - 1) * 0.01)

    def get_base_stats(self, level: int):
        stats = super().get_base_stats(level)
        # 불 주사위 고유 스탯 추가
        stats.append({
            "icon": "🔥", 
            "name": "화염 피해", 
            "value": f"{self.calculate_damage(level):.0f}"
        })
        return stats

    def get_upgrade_preview(self, level: int):
        # 업그레이드 시 공격력 증가량
        return {"공격력": "+5", "화염 피해": "+5"}

    def get_powerup_preview(self, level: int):
        return {"공격력": "+30"}