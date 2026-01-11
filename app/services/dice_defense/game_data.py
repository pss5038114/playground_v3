# app/services/dice_defense/game_data.py

DICE_DATA = {
    # [Common]
    "fire": {
        "name": "Fire", "rarity": "Common", "color": "bg-red-500", "symbol": "fa-fire", "desc": "기본적인 불 속성 주사위입니다.",
        "stats": {
            "atk": {"base": 20, "c": 3, "p": 10},
            "speed": {"base": 0.8, "c": -0.01, "p": 0},
            "target": "앞쪽",
            "specials": [
                {"name": "화염 데미지", "icon": "fa-fire", "base": 20, "c": 3, "p": 20, "format": "{}"}
            ]
        }
    },
    "electric": {
        "name": "Electric", "rarity": "Common", "color": "bg-orange-300", "symbol": "fa-bolt", "desc": "전기 충격을 가합니다.",
        "stats": {
            "atk": {"base": 30, "c": 3, "p": 10},
            "speed": {"base": 0.7, "c": -0.02, "p": 0},
            "target": "앞쪽",
            "specials": [
                {"name": "전기 데미지", "icon": "fa-bolt", "base": 30, "c": 3, "p": 20, "format": "{}"}
            ]
        }
    },
    "wind": {
        "name": "Wind", "rarity": "Common", "color": "bg-teal-300", "symbol": "fa-wind", "desc": "빠른 공격 속도를 가집니다.",
        "stats": {
            "atk": {"base": 20, "c": 3, "p": 15},
            "speed": {"base": 0.45, "c": 0, "p": 0},
            "target": "앞쪽",
            "specials": [
                {"name": "공속 증가", "icon": "fa-wind", "base": 10, "c": 2, "p": 10, "format": "{}%"}
            ]
        }
    },
    "poison": {
        "name": "Poison", "rarity": "Common", "color": "bg-green-500", "symbol": "fa-skull-crossbones", "desc": "지속 데미지를 입힙니다.",
        "stats": {
            "atk": {"base": 20, "c": 2, "p": 10},
            "speed": {"base": 1.3, "c": 0, "p": 0},
            "target": "무작위",
            "specials": [
                {"name": "독 데미지", "icon": "fa-skull-crossbones", "base": 50, "c": 5, "p": 25, "format": "{}"}
            ]
        }
    },
    "ice": {
        "name": "Ice", "rarity": "Common", "color": "bg-blue-300", "symbol": "fa-snowflake", "desc": "적을 느리게 만듭니다.",
        "stats": {
            "atk": {"base": 30, "c": 3, "p": 30},
            "speed": {"base": 1.5, "c": -0.02, "p": 0},
            "target": "앞쪽",
            "specials": [
                {"name": "얼음 효과", "icon": "fa-snowflake", "base": 5, "c": 0.5, "p": 2, "format": "{}%"}
            ]
        }
    },
    
    # [Rare]
    "mining": {
        "name": "Mining", "rarity": "Rare", "color": "bg-cyan-400", "symbol": "fa-hammer", "desc": "일정 확률로 SP를 획득합니다.",
        "stats": {
            "atk": "-", "speed": "-", "target": "-",
            "specials": [
                {"name": "SP 생산량", "icon": "fa-coins", "base": 3, "c": 0, "p": 5, "format": "{}"},
                {"name": "생산 시간", "icon": "fa-clock", "base": 10, "c": -0.5, "p": 0, "format": "{}s"}
            ]
        }
    },
    "light": {
        "name": "Light", "rarity": "Rare", "color": "bg-yellow-400", "symbol": "fa-sun", "desc": "공격 속도를 증가시킵니다.",
        "stats": {
            "atk": "-", "speed": "-", "target": "-",
            "specials": [
                {"name": "공속 버프", "icon": "fa-sun", "base": 6, "c": 0.3, "p": 1, "format": "{}%"}
            ]
        }
    },
    
    # [Hero]
    "adapt": {
        "name": "Adapt", "rarity": "Hero", "color": "bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400", "symbol": "fa-dice-d20", "desc": "모든 주사위와 합쳐질 수 있습니다.",
        "stats": {
            "atk": {"base": 20, "c": 5, "p": 10},
            "speed": {"base": 1.0, "c": 0, "p": 0},
            "target": "앞쪽",
            "specials": []
        }
    },
    "infection": {
        "name": "Infection", "rarity": "Hero", "color": "bg-lime-400", "symbol": "fa-biohazard", "desc": "주변 적에게 감염을 퍼뜨립니다.",
        "stats": {
            "atk": "-",
            "speed": {"base": 5.0, "c": -0.02, "p": 0},
            "target": "무작위",
            "specials": [
                {"name": "가스 공격", "icon": "fa-biohazard", "base": 100, "c": 5, "p": 100, "format": "{}"},
                {"name": "지속 시간", "icon": "fa-hourglass-half", "base": 3, "c": 0, "p": 0, "format": "{}s"}
            ]
        }
    },
    
    # [Legend]
    "typhoon": {
        "name": "Typhoon", "rarity": "Legend", "color": "bg-teal-700", "symbol": "fa-hurricane", "desc": "일정 시간 동안 변신하여 폭풍 공격을 합니다.",
        "stats": {
            "atk": {"base": 20, "c": 0, "p": 30},
            "speed": {"base": 0.6, "c": -0.02, "p": 0},
            "target": "앞쪽",
            "specials": [
                {"name": "1단 변신", "icon": "fa-wind", "base": 4, "c": 0.7, "p": 0, "format": "{}s"},
                {"name": "2단 변신", "icon": "fa-bolt", "base": 1, "c": 0.7, "p": 0, "format": "{}s"}
            ]
        }
    }
}

RARITY_ORDER = {"Common": 1, "Rare": 2, "Hero": 3, "Legend": 4}