# 주사위 등급 정의 및 확률 [사용자 요구사항 반영]
RARITY_CONFIG = {
    "Common": {"prob": 0.52, "color": "#ffffff", "border": "#ef4444"}, # 불(Red), 바람(Mint) 등
    "Rare": {"prob": 0.30, "color": "#ffffff", "border": "#facc15"},   # 빛(Yellow)
    "Epic": {"prob": 0.15, "color": "#ffffff", "border": "#a855f7"},   # 적응(Rainbow - 대략 보라색)
    "Legendary": {"prob": 0.03, "color": "#ffffff", "border": "#2dd4bf"} # 태풍(Jade)
}

# 기본 주사위 데이터 리스트
DICE_BOOK = {
    "fire": {"name": "불 주사위", "rarity": "Common", "color": "#ef4444"},
    "wind": {"name": "바람 주사위", "rarity": "Common", "color": "#2dd4bf"},
    "light": {"name": "빛 주사위", "rarity": "Rare", "color": "#facc15"},
    "adapt": {"name": "적응 주사위", "rarity": "Epic", "color": "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)"},
    "typhoon": {"name": "태풍 주사위", "rarity": "Legendary", "color": "#0ea5e9"}
}