// web/dice/js/utils.js

// [NEW] 주사위 크기 추정 함수 (Tailwind 클래스 파싱)
function getDiceSize(sizeClass) {
    if (!sizeClass) return 48; // 기본값 (w-12 = 48px)

    // w-숫자 또는 w-[값] 패턴 찾기
    const match = sizeClass.match(/w-(\[?[\d.]+(px|rem)?\]?|\d+)/);
    
    if (match) {
        let val = match[1];
        // 1. 임의 값 w-[50px]
        if (val.startsWith('[')) {
            val = val.replace(/[\[\]]/g, '');
            if (val.endsWith('px')) return parseFloat(val);
            if (val.endsWith('rem')) return parseFloat(val) * 16; 
            return parseFloat(val);
        } 
        // 2. 기본 척도 w-10 (1 unit = 4px)
        else if (!isNaN(val)) {
            return parseFloat(val) * 4; 
        }
    }
    
    // [수정] w-full일 때 추정치 상향 (64 -> 80)
    // 전투 화면 하단 바 등에서 w-full 사용 시 좀 더 두껍게 나오도록 유도
    if (sizeClass.includes('w-full')) return 80; 
    
    return 48;
}

function getDiceVisualClasses(dice, sizePx) {
    const colorClass = dice.color || 'bg-slate-500'; 
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
    // [수정] 단위 두께 계산 로직 개선
    // 1. 비율 상향: 전체 크기의 6% -> 10% (더 두껍게)
    // 2. 최대값 상향: 9px -> 24px (큰 주사위에서도 두께 유지)
    const totalBorderWidth = Math.max(3, Math.min(sizePx * 0.1, 24)); 
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
    return `<div class="dice-content w-[25%] h-[25%] rounded-full ${colorClass} shadow-sm z-10"></div>`;
}

// 주사위 배경(Background) 생성
function renderDiceBackground(dice, sizeClass="w-10 h-10", childrenHtml="") {
    const sizePx = getDiceSize(sizeClass);
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice, sizePx);
    
    let borderStyle = "";
    if (dice.rarity !== 'Legend') {
        // 일반 등급은 단위 두께의 3배를 적용하여 전설과 전체 두께를 맞춤
        borderStyle = `border-style: solid; border-width: calc(var(--dice-border-unit) * 3);`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0"><i class="${symbolIcon} text-4xl"></i></div>`;
    
    return `<div class="dice-face ${sizeClass} ${borderColor} ${effectClasses}" style="${customStyle} ${borderStyle}">
        ${bgSymbolHtml}
        ${childrenHtml}
    </div>`;
}

// [MODIFIED] 메인 렌더링 함수 (기존 코드와의 호환성 유지)
// pipCount 인자를 추가하여 눈의 개수를 조절할 수 있음 (기본값 1)
function renderDiceIcon(dice, sizeClass="w-10 h-10", pipCount=1) {
    const pipsHtml = renderDicePips(dice, pipCount);
    return renderDiceBackground(dice, sizeClass, pipsHtml);
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