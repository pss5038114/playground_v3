// web/dice/js/utils.js

// 주사위 크기 추정 함수
function getDiceSize(sizeClass, customSizePx = null) {
    // 1. 외부에서 명시적으로 크기를 줬으면 사용
    if (customSizePx && typeof customSizePx === 'number' && customSizePx > 0) {
        return customSizePx;
    }

    if (!sizeClass) return 48;

    const match = sizeClass.match(/w-(\[?[\d.]+(px|rem)?\]?|\d+)/);
    if (match) {
        let val = match[1];
        if (val.startsWith('[')) {
            val = val.replace(/[\[\]]/g, '');
            if (val.endsWith('px')) return parseFloat(val);
            if (val.endsWith('rem')) return parseFloat(val) * 16;
            return parseFloat(val);
        } 
        else if (!isNaN(val)) {
            return parseFloat(val) * 4; 
        }
    }
    
    // [수정] w-full 추정치 상향 (80 -> 100)
    // 파워업 버튼 등에서 크기 측정이 안 될 때, 큼직하게 보이도록 기본값 상향
    if (sizeClass.includes('w-full')) return 100; 
    
    return 48;
}

function getDiceVisualClasses(dice, sizePx) {
    const colorClass = dice.color || 'bg-slate-500'; 
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
    // [수정] 테두리 비율 조정: 10% -> 8% (조금 더 세련되게)
    // 최소 2px 보장
    const totalBorderWidth = Math.max(2, Math.min(sizePx * 0.08, 100)); 
    const unitWidth = totalBorderWidth / 3; 
    
    customStyle += `--dice-border-unit: ${unitWidth.toFixed(2)}px; `;

    if (dice.rarity === 'Legend') {
        effectClasses += " dice-legend-style";
        let hexColor = dice.id === 'typhoon' ? "#0f766e" : "#fbbf24"; 
        customStyle += `--dice-color: ${hexColor}; border-color: ${hexColor};`;
        borderColor = ""; 
    }
    
    return { borderColor, effectClasses, customStyle };
}

// [수정] 주사위 눈(Pip) 동적 크기 적용
// css 클래스 대신 style로 정확한 크기 지정
function renderDicePips(dice, count = 1, sizePx = 48) {
    if (count === 0) return ""; 
    const colorClass = dice.color || 'bg-slate-500';
    
    // 눈 크기: 전체의 24% 정도 (기존 25%와 비슷하지만 픽셀 고정으로 선명함 유지)
    const pipSize = Math.max(4, Math.floor(sizePx * 0.24));
    
    return `<div class="dice-content rounded-full ${colorClass} shadow-sm z-10" 
                 style="width: ${pipSize}px; height: ${pipSize}px;"></div>`;
}

function renderDiceBackground(dice, sizeClass="w-10 h-10", childrenHtml="", customSizePx=null) {
    const sizePx = getDiceSize(sizeClass, customSizePx);
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice, sizePx);
    
    let borderStyle = "";
    if (dice.rarity !== 'Legend') {
        borderStyle = `border-style: solid; border-width: calc(var(--dice-border-unit) * 3);`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    
    // 아이콘 크기: 60%
    const iconSize = Math.max(12, Math.floor(sizePx * 0.6));
    
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0">
        <i class="${symbolIcon}" style="font-size: ${iconSize}px; line-height: 1;"></i>
    </div>`;
    
    return `<div class="dice-face ${sizeClass} ${borderColor} ${effectClasses}" style="${customStyle} ${borderStyle}">
        ${bgSymbolHtml}
        ${childrenHtml}
    </div>`;
}

// [수정] pipCount 렌더링 시 sizePx 전달
function renderDiceIcon(dice, sizeClass="w-10 h-10", pipCount=1, customSizePx=null) {
    const sizePx = getDiceSize(sizeClass, customSizePx);
    // Pips 생성 시에도 크기 정보를 넘겨줌
    const pipsHtml = renderDicePips(dice, pipCount, sizePx);
    return renderDiceBackground(dice, sizeClass, pipsHtml, sizePx);
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