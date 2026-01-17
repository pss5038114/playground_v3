# app/services/dice_defense/entities/normal_mob.py
from .base_entity import BaseEntity

class NormalMob(BaseEntity):
    @property
    def default_stats(self):
        return {
            "type": "normal_mob",
            "hp": 100,
            "max_hp": 100,
            "speed": 250,       # 속도 조절
            "radius": 30,       # 시각적 크기 (기존 24보다 크게)
            "hitbox_radius": 30 # 히트박스 크기 (일단 시각적 크기와 동일하게)
        }