// web/dice/js/utils.js

// [수정] 주사위 크기 추정 함수 (customSizePx 우선 사용)
function getDiceSize(sizeClass, customSizePx = null) {
    // 1. 외부에서 명시적으로 크기를 줬으면 그것을 최우선으로 사용
    if (customSizePx && typeof customSizePx === 'number' && customSizePx > 0) {
        return customSizePx;
    }

    if (!sizeClass) return 48; // 기본값 (w-12 = 48px)

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
    
    // w-full일 때의 추정치 (customSizePx가 없을 때만 사용됨)
    if (sizeClass.includes('w-full')) return 80; 
    
    return 48;
}

function getDiceVisualClasses(dice, sizePx) {
    const colorClass = dice.color || 'bg-slate-500'; 
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
    // [설정 유지] 테두리: 10% 비율, 최대 100px
    const totalBorderWidth = Math.max(2, Math.min(sizePx * 0.10, 100)); 
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

// 주사위 눈(Pips) 생성
function renderDicePips(dice, count = 1) {
    if (count === 0) return ""; 
    const colorClass = dice.color || 'bg-slate-500';
    // 눈 크기도 약간 동적으로? 일단 25% 유지
    return `<div class="dice-content w-[25%] h-[25%] rounded-full ${colorClass} shadow-sm z-10"></div>`;
}

/// [수정] customSizePx 인자 추가
function renderDiceBackground(dice, sizeClass="w-10 h-10", childrenHtml="", customSizePx=null) {
    // 1. 크기 계산 (명시적 크기 우선)
    const sizePx = getDiceSize(sizeClass, customSizePx);
    
    // 2. 스타일 클래스 생성
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice, sizePx);
    
    // 3. 테두리 스타일
    let borderStyle = "";
    if (dice.rarity !== 'Legend') {
        borderStyle = `border-style: solid; border-width: calc(var(--dice-border-unit) * 3);`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    
    // 아이콘 크기: 주사위 크기의 60%
    const iconSize = Math.max(12, Math.floor(sizePx * 0.6));
    
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0">
        <i class="${symbolIcon}" style="font-size: ${iconSize}px; line-height: 1;"></i>
    </div>`;
    
    return `<div class="dice-face ${sizeClass} ${borderColor} ${effectClasses}" style="${customStyle} ${borderStyle}">
        ${bgSymbolHtml}
        ${childrenHtml}
    </div>`;
}

// [수정] customSizePx 인자 추가 및 전달
function renderDiceIcon(dice, sizeClass="w-10 h-10", pipCount=1, customSizePx=null) {
    const pipsHtml = renderDicePips(dice, pipCount);
    return renderDiceBackground(dice, sizeClass, pipsHtml, customSizePx);
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