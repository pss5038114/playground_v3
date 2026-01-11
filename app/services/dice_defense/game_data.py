# app/services/dice_defense/game_data.py

DICE_DATA = {
    # Common (5)
    "fire": {"name": "Fire", "rarity": "Common", "color": "bg-red-500", "desc": "기본적인 불 속성 주사위입니다."},
    "electric": {"name": "Electric", "rarity": "Common", "color": "bg-orange-300", "desc": "전기 충격을 가합니다."},
    "wind": {"name": "Wind", "rarity": "Common", "color": "bg-teal-300", "desc": "빠른 공격 속도를 가집니다."},
    "poison": {"name": "Poison", "rarity": "Common", "color": "bg-green-500", "desc": "지속 데미지를 입힙니다."},
    "ice": {"name": "Ice", "rarity": "Common", "color": "bg-blue-300", "desc": "적을 느리게 만듭니다."},
    
    # Rare (2)
    "mining": {"name": "Mining", "rarity": "Rare", "color": "bg-cyan-400", "desc": "일정 확률로 SP를 획득합니다."},
    "light": {"name": "Light", "rarity": "Rare", "color": "bg-yellow-400", "desc": "공격 속도를 증가시킵니다."},
    
    # Hero (2)
    "adapt": {"name": "Adapt", "rarity": "Hero", "color": "bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400", "desc": "모든 주사위와 합쳐질 수 있습니다."},
    "infection": {"name": "Infection", "rarity": "Hero", "color": "bg-lime-400", "desc": "주변 적에게 감염을 퍼뜨립니다."},
    
    # Legend (1)
    "typhoon": {"name": "Typhoon", "rarity": "Legend", "color": "bg-teal-700", "desc": "일정 시간 동안 변신하여 폭풍 공격을 합니다."}
}

# 정렬 및 로직용 유틸리티
RARITY_ORDER = {"Common": 1, "Rare": 2, "Hero": 3, "Legend": 4}