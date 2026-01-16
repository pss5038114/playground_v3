// web/dice/js/utils.js

function getDiceVisualClasses(dice) {
    const colorClass = dice.color || 'bg-slate-500'; 
    
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
    if (dice.rarity === 'Legend') {
        effectClasses += " dice-legend-style";
        let hexColor = dice.id === 'typhoon' ? "#0f766e" : "#fbbf24"; 
        customStyle = `--dice-color: ${hexColor}; border-color: ${hexColor};`;
        borderColor = ""; 
    }
    return { borderColor, effectClasses, customStyle };
}

function renderDiceIcon(dice, sizeClass="w-10 h-10") {
    // [NEW] 1. 크기 분석 (w-10 -> 10, w-32 -> 32)
    let sizeIndex = 10; // 기본값
    const match = sizeClass.match(/w-\[?(\d+)\]?/);
    if (match) {
        sizeIndex = parseInt(match[1], 10);
    }

    // [NEW] 2. 비례 수치 계산
    // 테두리: 너비의 약 5% (Tailwind 1단위 = 4px, 0.2배 하면 0.8px... 좀 얇음. 0.25배 -> 1px.
    // w-10(40px)일 때 2px이 적당하므로 factor 0.2 (10 * 0.2 = 2px)
    // w-32(128px)일 때 32 * 0.2 = 6.4px (약 6~7px) -> 적절함
    const borderWidth = Math.max(2, sizeIndex * 0.2); 
    const borderWidthPx = `${borderWidth.toFixed(1)}px`;
    
    // 배경 아이콘 크기: 너비의 약 90%
    const fontSize = sizeIndex * 4 * 0.9; 

    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice);
    
    // [NEW] 3. 스타일 조합
    let finalCustomStyle = customStyle;
    let finalBorderClass = borderColor;

    if (dice.rarity === 'Legend') {
        // 전설: CSS 변수로 두께 전달
        finalCustomStyle += ` --dice-border-width: ${borderWidthPx};`;
    } else {
        // 일반/희귀/영웅: 직접 border-width 설정 (border-2 클래스 제거 대신)
        finalCustomStyle += ` border-width: ${borderWidthPx}; border-style: solid;`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    const colorClass = dice.color || 'bg-slate-500';

    // [수정] 배경 아이콘 크기(fontSize) 적용
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0" style="font-size: ${fontSize}px; line-height: 1;"><i class="${symbolIcon}"></i></div>`;
    
    // [수정] borderBase(border-2) 제거하고 finalBorderClass 및 finalCustomStyle 사용
    return `<div class="dice-face ${sizeClass} ${finalBorderClass} ${effectClasses}" style="${finalCustomStyle}">${bgSymbolHtml}<div class="dice-content w-[25%] h-[25%] rounded-full ${colorClass} shadow-sm z-10"></div></div>`;
}

function getRarityBgIcon(rarity) {
    switch(rarity) { case 'Legend': return 'ri-vip-crown-line'; case 'Hero': return 'ri-sword-line'; case 'Rare': return 'ri-shield-line'; default: return 'ri-focus-line'; }
}

function getRarityDotColor(rarity) {
    switch(rarity) { case 'Legend': return 'bg-yellow-400'; case 'Hero': return 'bg-purple-500'; case 'Rare': return 'bg-blue-500'; default: return 'bg-gray-400'; }
}

function getRarityBgTextColor(rarity) {
    switch(rarity) { 
        case 'Legend': return 'text-yellow-200'; 
        case 'Hero': return 'text-purple-200';   
        case 'Rare': return 'text-blue-200';     
        default: return 'text-slate-200';        
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 캔버스 그리기 유틸리티
function drawRoundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// 전역 등록 (필요시)
window.sleep = sleep;
window.drawRoundedRect = drawRoundedRect;