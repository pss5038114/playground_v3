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
            if (val.endsWith('rem')) return parseFloat(val) * 16; // 1rem = 16px 가정
            return parseFloat(val);
        } 
        // 2. 기본 척도 w-10 (1 unit = 4px)
        else if (!isNaN(val)) {
            return parseFloat(val) * 4; 
        }
    }
    
    // w-full 등 알 수 없는 경우, 대략적인 중간 크기 반환
    if (sizeClass.includes('w-full')) return 64; 
    
    return 48;
}

function getDiceVisualClasses(dice, sizePx) {
    // [수정] 방어 코드: color가 없으면 기본값 사용
    const colorClass = dice.color || 'bg-slate-500'; 
    
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
    // [NEW] 동적 테두리 두께 계산 (전체 크기의 5% 정도)
    // 최소 2px, 최대 8px 정도로 제한하면 더 보기 좋음
    const borderWidth = Math.max(2, Math.min(sizePx * 0.05, 8));
    customStyle += `--dice-border: ${borderWidth.toFixed(1)}px; `;

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
    // 1. 크기 계산
    const sizePx = getDiceSize(sizeClass);
    
    // 2. 스타일 클래스 및 변수 생성
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice, sizePx);
    
    // 3. 테두리 적용 (Legend는 CSS에서 처리, 나머지는 인라인 스타일로 동적 두께 적용)
    // 기존 'border-2' 제거하고 인라인으로 대체
    let borderStyle = "";
    if (dice.rarity !== 'Legend') {
        borderStyle = `border-style: solid; border-width: var(--dice-border);`;
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