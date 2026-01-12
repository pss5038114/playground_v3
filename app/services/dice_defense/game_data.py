# app/services/dice_defense/game_data.py

DICE_DATA = {
    # [Common]
    "fire": {
        "name": "Fire", "rarity": "Common", "color": "bg-red-500", 
        "symbol": "ri-fire-fill", # 화염
        "desc": "기본적인 불 속성 주사위입니다.",
        "stats": { "atk": {"base": 20, "c": 3, "p": 10}, "speed": {"base": 0.8, "c": -0.01, "p": 0}, "target": "앞쪽", "specials": [{"name": "화염 데미지", "icon": "ri-fire-line", "base": 20, "c": 3, "p": 20, "format": "{}"}] }
    },
    "electric": {
        "name": "Electric", "rarity": "Common", "color": "bg-orange-300", 
        "symbol": "ri-flashlight-fill", # 번개
        "desc": "전기 충격을 가합니다.",
        "stats": { "atk": {"base": 30, "c": 3, "p": 10}, "speed": {"base": 0.7, "c": -0.02, "p": 0}, "target": "앞쪽", "specials": [{"name": "전기 데미지", "icon": "ri-flashlight-line", "base": 30, "c": 3, "p": 20, "format": "{}"}] }
    },
    "wind": {
        "name": "Wind", "rarity": "Common", "color": "bg-teal-300", 
        "symbol": "ri-windy-fill", # 바람
        "desc": "빠른 공격 속도를 가집니다.",
        "stats": { "atk": {"base": 20, "c": 3, "p": 15}, "speed": {"base": 0.45, "c": 0, "p": 0}, "target": "앞쪽", "specials": [{"name": "공속 증가", "icon": "ri-windy-line", "base": 10, "c": 2, "p": 10, "format": "{}%"}] }
    },
    "poison": {
        "name": "Poison", "rarity": "Common", "color": "bg-green-500", 
        "symbol": "ri-skull-2-fill", # 해골
        "desc": "지속 데미지를 입힙니다.",
        "stats": { "atk": {"base": 20, "c": 2, "p": 10}, "speed": {"base": 1.3, "c": 0, "p": 0}, "target": "무작위", "specials": [{"name": "독 데미지", "icon": "ri-skull-2-line", "base": 50, "c": 5, "p": 25, "format": "{}"}] }
    },
    "ice": {
        "name": "Ice", "rarity": "Common", "color": "bg-blue-300", 
        "symbol": "ri-snowflake-fill", # 눈송이 (안되면 ri-snowy-fill)
        "desc": "적을 느리게 만듭니다.",
        "stats": { "atk": {"base": 30, "c": 3, "p": 30}, "speed": {"base": 1.5, "c": -0.02, "p": 0}, "target": "앞쪽", "specials": [{"name": "얼음 효과", "icon": "ri-snowflake-line", "base": 5, "c": 0.5, "p": 2, "format": "{}%"}] }
    },
    
    # [Rare]
    "mining": {
        "name": "Mining", "rarity": "Rare", "color": "bg-cyan-400", 
        "symbol": "ri-hammer-fill", # 채굴 망치
        "desc": "일정 확률로 SP를 획득합니다.",
        "stats": { "atk": "-", "speed": "-", "target": "-", "specials": [{"name": "SP 생산량", "icon": "ri-coins-line", "base": 3, "c": 0, "p": 5, "format": "{}"}, {"name": "생산 시간", "icon": "ri-time-line", "base": 10, "c": -0.5, "p": 0, "format": "{}s"}] }
    },
    "light": {
        "name": "Light", "rarity": "Rare", "color": "bg-yellow-400", 
        "symbol": "ri-arrow-up-double-line", # 위화살표/빛
        "desc": "공격 속도를 증가시킵니다.",
        "stats": { "atk": "-", "speed": "-", "target": "-", "specials": [{"name": "공속 버프", "icon": "ri-sun-line", "base": 6, "c": 0.3, "p": 1, "format": "{}%"}] }
    },
    
    # [Hero]
    "adapt": {
        "name": "Adapt", "rarity": "Hero", "color": "bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400", 
        "symbol": "ri-infinity-line", # 무한/적응
        "desc": "모든 주사위와 합쳐질 수 있습니다.",
        "stats": { "atk": {"base": 20, "c": 5, "p": 10}, "speed": {"base": 1.0, "c": 0, "p": 0}, "target": "앞쪽", "specials": [] }
    },
    "infection": {
        "name": "Infection", "rarity": "Hero", "color": "bg-lime-400", 
        "symbol": "ri-virus-fill", # 감염/바이러스
        "desc": "주변 적에게 감염을 퍼뜨립니다.",
        "stats": { "atk": "-", "speed": {"base": 5.0, "c": -0.02, "p": 0}, "target": "무작위", "specials": [{"name": "가스 공격", "icon": "ri-virus-line", "base": 100, "c": 5, "p": 100, "format": "{}"}, {"name": "지속 시간", "icon": "ri-hourglass-fill", "base": 3, "c": 0, "p": 0, "format": "{}s"}] }
    },
    
    # [Legend]
    "typhoon": {
        "name": "Typhoon", "rarity": "Legend", "color": "bg-teal-700", 
        "symbol": "ri-typhoon-fill", # 태풍 (Remix Icon에는 typhoon 아이콘이 따로 있음)
        "desc": "일정 시간 동안 변신하여 폭풍 공격을 합니다.",
        "stats": { "atk": {"base": 20, "c": 0, "p": 30}, "speed": {"base": 0.6, "c": -0.02, "p": 0}, "target": "앞쪽", "specials": [{"name": "1단 변신", "icon": "ri-windy-line", "base": 4, "c": 0.7, "p": 0, "format": "{}s"}, {"name": "2단 변신", "icon": "ri-flashlight-line", "base": 1, "c": 0.7, "p": 0, "format": "{}s"}] }
    }
}

UPGRADE_RULES = {
    "gold": [
        1000, 2000, 3000, 4000, 5000, 
        7500, 10000, 15000, 30000, 50000, 
        100000, 150000, 200000, 250000, 300000, 
        350000, 400000, 450000, 500000, 1000000
    ],
    "cards": {
        "Common": [
            1, 2, 4, 8, 10, 
            12, 14, 16, 18, 20, 
            25, 30, 35, 40, 50, 
            60, 70, 80, 90, 100
        ],
        "Rare": [
            1, 2, 4, 6, 8, 
            10, 12, 14, 16, 18, 
            20, 22, 24, 26, 28, 
            30, 35, 40, 45, 50
        ],
        "Hero": [
            1, 2, 3, 4, 5, 
            6, 7, 8, 9, 10, 
            11, 12, 13, 14, 15, 
            16, 17, 18, 19, 20
        ],
        "Legend": [
            1, 1, 1, 1, 1, 
            2, 2, 2, 2, 2, 
            3, 3, 3, 3, 3, 
            4, 4, 4, 4, 4
        ]
    }
}

RARITY_ORDER = {"Common": 1, "Rare": 2, "Hero": 3, "Legend": 4}