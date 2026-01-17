// web/dice/js/utils.js

// 주사위 크기 추정 함수
function getDiceSize(sizeClass, customSizePx = null) {
    if (customSizePx && typeof customSizePx === 'number' && customSizePx > 0) return customSizePx;
    if (!sizeClass) return 48;
    const match = sizeClass.match(/w-(\[?[\d.]+(px|rem)?\]?|\d+)/);
    if (match) {
        let val = match[1];
        if (val.startsWith('[')) {
            val = val.replace(/[\[\]]/g, '');
            if (val.endsWith('px')) return parseFloat(val);
            if (val.endsWith('rem')) return parseFloat(val) * 16;
            return parseFloat(val);
        } else if (!isNaN(val)) {
            return parseFloat(val) * 4; 
        }
    }
    if (sizeClass.includes('w-full')) return 80; 
    return 48;
}

function getDiceVisualClasses(dice, sizePx) {
    const colorClass = dice.color || 'bg-slate-500'; 
    let borderColor = colorClass.replace('bg-', 'border-');
    if(colorClass.includes('gradient')) borderColor = 'border-slate-300';
    
    let effectClasses = "dice-glossy"; 
    let customStyle = "";
    
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

// [수정] 주사위 눈(Pips) 배치 로직 구현
function renderDicePips(dice, count = 1) {
    if (count <= 0) return ""; 

    // [핵심] dice.color(예: bg-red-500)를 눈의 배경색으로 직접 사용
    const pipColorClass = dice.color || 'bg-slate-500';
    
    const size = "w-[24%] h-[24%]";
    
    // 위치 좌표 (Tailwind arbitrary values 활용)
    const pos = {
        tl: "top-[10%] left-[10%]", tc: "top-[10%] left-[38%]", tr: "top-[10%] right-[10%]",
        cl: "top-[38%] left-[10%]", cc: "top-[38%] left-[38%]", cr: "top-[38%] right-[10%]",
        bl: "bottom-[10%] left-[10%]", bc: "bottom-[10%] left-[38%]", br: "bottom-[10%] right-[10%]"
    };

    // 눈 개수별 배치 설정
    const configs = {
        1: ['cc'],
        2: ['tl', 'br'],
        3: ['tl', 'cc', 'br'],
        4: ['tl', 'tr', 'bl', 'br'],
        5: ['tl', 'tr', 'cc', 'bl', 'br'],
        6: ['tl', 'cl', 'bl', 'tr', 'cr', 'br'], // 세로형 6
        7: ['tl', 'cl', 'bl', 'cc', 'tr', 'cr', 'br']
    };
    
    const currentConfig = configs[Math.min(count, 7)] || configs[1];
    
    // bg-current 대신 pipColorClass 사용
    return `<div class="absolute inset-0 w-full h-full p-[15%] z-10 pointer-events-none">
        <div class="relative w-full h-full">
            ${currentConfig.map(p => 
                `<div class="absolute ${pos[p]} ${size} rounded-full ${pipColorClass} shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/20"></div>`
            ).join('')}
        </div>
    </div>`;
}

function renderDiceBackground(dice, sizeClass="w-10 h-10", childrenHtml="", customSizePx=null) {
    const sizePx = getDiceSize(sizeClass, customSizePx);
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice, sizePx);
    
    let borderStyle = "";
    if (dice.rarity !== 'Legend') {
        borderStyle = `border-style: solid; border-width: calc(var(--dice-border-unit) * 3);`;
    }

    const symbolIcon = dice.symbol || "ri-dice-fill";
    const iconSize = Math.max(12, Math.floor(sizePx * 0.6));
    
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0">
        <i class="${symbolIcon}" style="font-size: ${iconSize}px; line-height: 1;"></i>
    </div>`;
    
    return `<div class="dice-face ${sizeClass} ${borderColor} ${effectClasses}" style="${customStyle} ${borderStyle}">
        ${bgSymbolHtml}
        ${childrenHtml}
    </div>`;
}

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