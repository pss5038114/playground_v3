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

// [핵심 수정] 주사위 아이콘 렌더링 (눈 개수 조절 가능)
// pips: 0(숨김), 1~6(일반), 7(별)
function renderDiceIcon(dice, sizeClass="w-10 h-10", pips=1) {
    // 1. 크기 분석
    let sizeIndex = 10; 
    const match = sizeClass.match(/w-\[?(\d+)\]?/);
    if (match) sizeIndex = parseInt(match[1], 10);
    else if (sizeClass.includes('w-full')) sizeIndex = 14; // 기본값

    const borderWidth = Math.max(2, sizeIndex * 0.2); 
    const borderWidthPx = `${borderWidth.toFixed(1)}px`;
    const fontSize = sizeIndex * 4 * 0.9; 

    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice);
    
    // 2. 스타일 조합
    let finalCustomStyle = customStyle;
    let finalBorderClass = borderColor;

    if (dice.rarity === 'Legend') {
        finalCustomStyle += ` --dice-border-width: ${borderWidthPx};`;
    } else {
        finalCustomStyle += ` border-width: ${borderWidthPx}; border-style: solid;`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    const colorClass = dice.color || 'bg-slate-500';

    // 3. 배경 심볼 (pips가 0일 때 더 잘 보이게 투명도 조정)
    // pips === 0 (파워업) -> opacity-20 (잘 보임)
    // pips > 0 (인게임) -> opacity-30 (눈에 방해 안 되게)
    const bgOpacity = pips === 0 ? 'opacity-20' : 'opacity-30';
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none ${bgOpacity} text-slate-400 z-0" style="font-size: ${fontSize}px; line-height: 1;"><i class="${symbolIcon}"></i></div>`;
    
    // 4. 주사위 눈(Pips) 생성
    let pipsHtml = '';
    if (pips > 0) {
        pipsHtml = renderPips(pips, colorClass);
    }

    return `<div class="dice-face ${sizeClass} ${finalBorderClass} ${effectClasses} relative flex items-center justify-center" style="${finalCustomStyle}">
        ${bgSymbolHtml}
        ${pipsHtml}
    </div>`;
}

// [신규] 주사위 눈 배치 로직
function renderPips(count, colorClass) {
    if (count === 7) {
        // 7성 (별)
        return `<div class="absolute inset-0 flex items-center justify-center z-10">
            <i class="ri-star-fill text-yellow-400 drop-shadow-md" style="font-size: 70%;"></i>
        </div>`;
    }

    // 위치 좌표 (Top-Left, Top-Right, Middle-Left, Center, Middle-Right, Bottom-Left, Bottom-Right)
    const pos = {
        tl: 'top-[20%] left-[20%]',  tr: 'top-[20%] right-[20%]',
        ml: 'top-[50%] left-[20%] -translate-y-1/2', mr: 'top-[50%] right-[20%] -translate-y-1/2',
        cc: 'top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2',
        bl: 'bottom-[20%] left-[20%]', br: 'bottom-[20%] right-[20%]'
    };

    let activePos = [];
    switch(count) {
        case 1: activePos = [pos.cc]; break;
        case 2: activePos = [pos.tl, pos.br]; break;
        case 3: activePos = [pos.tl, pos.cc, pos.br]; break;
        case 4: activePos = [pos.tl, pos.tr, pos.bl, pos.br]; break;
        case 5: activePos = [pos.tl, pos.tr, pos.cc, pos.bl, pos.br]; break;
        case 6: activePos = [pos.tl, pos.tr, pos.ml, pos.mr, pos.bl, pos.br]; break;
    }

    // 눈의 크기는 부모 크기의 약 22%
    return activePos.map(p => 
        `<div class="absolute ${p} w-[22%] h-[22%] rounded-full ${colorClass} shadow-sm z-10"></div>`
    ).join('');
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