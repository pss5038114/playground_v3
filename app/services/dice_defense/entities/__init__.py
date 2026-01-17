# app/services/dice_defense/entities/__init__.py
from .base_entity import BaseEntity
from .normal_mob import NormalMob

# 엔티티 타입 ID와 클래스 매핑
ENTITY_MAP = {
    'normal_mob': NormalMob,
    # 추후 추가: 'fast_mob': FastMob, 'boss': BossMob ...
}

def get_entity_manager(entity_type: str) -> BaseEntity:
    """해당 타입의 로직 처리 클래스(싱글톤처럼 사용) 반환"""
    entity_class = ENTITY_MAP.get(entity_type, BaseEntity)
    return entity_class()