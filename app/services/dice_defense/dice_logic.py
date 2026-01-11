# app/services/dice_defense/dice_logic.py
import random
# [수정] dice 폴더 안의 dice_data를 바라보도록 경로 변경
from app.services.dice_defense.dice.dice_data import DICE_DATA, GACHA_PROBABILITY

def execute_gacha(draw_count: int):
    """
    요청한 횟수만큼 가챠를 실행하고 결과를 반환합니다.
    10회 요청 시 11회(10+1)를 실행합니다.
    """
    real_draw_count = draw_count
    if draw_count == 10:
        real_draw_count = 11  # 10+1 보너스
    
    results = []
    
    # 확률 테이블 준비 (Key: Rarity, Weight: Probability)
    rarities = list(GACHA_PROBABILITY.keys())
    weights = list(GACHA_PROBABILITY.values())
    
    for _ in range(real_draw_count):
        # 1. 등급 결정 (Weighted Random)
        selected_rarity = random.choices(rarities, weights=weights, k=1)[0]
        
        # 2. 해당 등급 내 주사위 결정 (Uniform Random)
        candidates = [did for did, info in DICE_DATA.items() if info['rarity'] == selected_rarity]
        selected_dice = random.choice(candidates)
        
        results.append(selected_dice)
        
    return results