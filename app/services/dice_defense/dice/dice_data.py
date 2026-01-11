# app/services/dice_defense/dice_data.py

# 희귀도 상수 정의
RARITY_COMMON = "Common"
RARITY_RARE = "Rare"
RARITY_HERO = "Hero"
RARITY_LEGEND = "Legend"

# 주사위 정적 데이터 (ID를 Key로 사용)
DICE_DATA = {
    # --- 일반 (Common) 5종 ---
    "fire": {
        "name": "불 주사위",
        "rarity": RARITY_COMMON,
        "desc": "강력한 폭발 데미지를 입힙니다.",
        "base_damage": 20,
        "attack_speed": 1.0
    },
    "electric": {
        "name": "전기 주사위",
        "rarity": RARITY_COMMON,
        "desc": "주변 적에게 전이를 일으켜 다수의 적을 공격합니다.",
        "base_damage": 15,
        "attack_speed": 0.8
    },
    "wind": {
        "name": "바람 주사위",
        "rarity": RARITY_COMMON,
        "desc": "공격 속도가 매우 빠릅니다.",
        "base_damage": 8,
        "attack_speed": 0.5
    },
    "poison": {
        "name": "독 주사위",
        "rarity": RARITY_COMMON,
        "desc": "적을 중독시켜 지속적인 피해를 줍니다.",
        "base_damage": 10,
        "attack_speed": 1.0
    },
    "ice": {
        "name": "얼음 주사위",
        "rarity": RARITY_COMMON,
        "desc": "적의 이동 속도를 늦춥니다.",
        "base_damage": 10,
        "attack_speed": 1.2
    },

    # --- 희귀 (Rare) 2종 ---
    "mining": {
        "name": "광산 주사위",
        "rarity": RARITY_RARE,
        "desc": "일정 시간마다 SP를 생산합니다. (공격 안함)",
        "base_damage": 0,
        "attack_speed": 5.0 
    },
    "light": {
        "name": "빛 주사위",
        "rarity": RARITY_RARE,
        "desc": "인접한 주사위의 공격 속도를 증가시킵니다. (공격 안함)",
        "base_damage": 0,
        "attack_speed": 0
    },

    # --- 영웅 (Hero) 2종 ---
    "death": {
        "name": "죽음 주사위",
        "rarity": RARITY_HERO,
        "desc": "일정 확률로 적을 즉사시킵니다. (보스 제외)",
        "base_damage": 25,
        "attack_speed": 1.2
    },
    "adapt": {
        "name": "적응 주사위",
        "rarity": RARITY_HERO,
        "desc": "같은 눈금의 모든 주사위와 합칠 수 있습니다.",
        "base_damage": 10,
        "attack_speed": 1.0
    },

    # --- 전설 (Legend) 1종 ---
    "typhoon": {
        "name": "태풍 주사위",
        "rarity": RARITY_LEGEND,
        "desc": "주기적으로 변신하여 공격 속도가 극한으로 빨라집니다.",
        "base_damage": 15,
        "attack_speed": 0.6 # 변신 시 0.1 등으로 감소 구현 예정
    }
}

# 등급별 등장 확률 (백분율)
GACHA_PROBABILITY = {
    RARITY_COMMON: 55,
    RARITY_RARE: 28,
    RARITY_HERO: 14,
    RARITY_LEGEND: 3
}

# 등급별 레벨업 비용 및 필요 카드 수 로직은 추후 DiceLogic 등에서 처리