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

// [NEW] 크기에 따른 테두리 두께 계산 함수
function getAdaptiveBorderWidth(sizeClass) {
    if (sizeClass.includes('w-32')) return 4; // 가챠 1회 (128px) -> 4px
    if (sizeClass.includes('w-20') || sizeClass.includes('w-24')) return 3; // 가챠 11회 (80px) -> 3px
    return 2; // 기본 (40~48px) -> 2px
}

// [NEW] 주사위 눈(Pips) HTML 생성 함수
// count: 0이면 눈을 그리지 않음. 1이상이면 현재는 기본 눈(가운데 점) 하나만 그림.
// 추후 1~7 주사위 눈 배치 로직을 이곳에 구현하면 됩니다.
function renderDicePips(dice, count = 1) {
    if (count === 0) return ""; // 0이면 빈 문자열 반환

    // 현재는 눈의 개수와 상관없이 중앙에 하나의 큰 점만 표시하는 기존 스타일 유지
    // 나중에 switch(count) 등으로 주사위 눈 배치를 다르게 할 수 있음
    const colorClass = dice.color || 'bg-slate-500';
    
    // [확장 가능성] 여기서 count에 따라 다른 HTML을 리턴하면 됨
    return `<div class="dice-content w-[25%] h-[25%] rounded-full ${colorClass} shadow-sm z-10"></div>`;
}

// [NEW] 주사위 배경(Background) 생성 함수
function renderDiceBackground(dice, sizeClass="w-10 h-10", childrenHtml="") {
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice);
    const symbolIcon = dice.symbol || "ri-dice-fill";
    
    // [NEW] 적응형 테두리 두께 계산
    const borderWidth = getAdaptiveBorderWidth(sizeClass);
    
    // 스타일 조합
    let finalStyle = customStyle;
    
    // 전설: CSS 변수로 두께 전달
    if (dice.rarity === 'Legend') {
        finalStyle += ` --dice-border-width: ${borderWidth}px;`;
    } 
    // 일반: 직접 border-width 스타일 적용
    else {
        finalStyle += ` border-width: ${borderWidth}px;`;
    }

    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0"><i class="${symbolIcon} text-4xl"></i></div>`;
    
    // border-2 클래스 제거 (스타일로 직접 제어)
    return `<div class="dice-face ${sizeClass} ${borderColor} ${effectClasses}" style="${finalStyle}">
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