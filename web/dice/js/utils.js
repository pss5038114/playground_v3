// web/dice/js/utils.js

function getDiceVisualClasses(dice) {
    // [방어 코드] color가 없으면 기본값 사용
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
    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice);
    const borderBase = dice.rarity === 'Legend' ? '' : 'border-2';
    const symbolIcon = dice.symbol || "ri-dice-fill";
    const colorClass = dice.color || 'bg-slate-500';

    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0"><i class="${symbolIcon} text-4xl"></i></div>`;
    
    return `<div class="dice-face ${sizeClass} ${borderBase} ${borderColor} ${effectClasses}" style="${customStyle}">${bgSymbolHtml}<div class="dice-content w-[25%] h-[25%] rounded-full ${colorClass} shadow-sm z-10"></div></div>`;
}

function getRarityBgIcon(rarity) {
    switch(rarity) { case 'Legend': return 'ri-vip-crown-line'; case 'Hero': return 'ri-sword-line'; case 'Rare': return 'ri-shield-line'; default: return 'ri-focus-line'; }
}

function getRarityDotColor(rarity) {
    switch(rarity) { case 'Legend': return 'bg-yellow-400'; case 'Hero': return 'bg-purple-500'; case 'Rare': return 'bg-blue-500'; default: return 'bg-gray-400'; }
}

// [NEW] 등급별 배경 아이콘 텍스트 색상 (은은한 틴트)
function getRarityBgTextColor(rarity) {
    switch(rarity) { 
        case 'Legend': return 'text-yellow-200'; // 금색 틴트
        case 'Hero': return 'text-purple-200';   // 보라색 틴트
        case 'Rare': return 'text-blue-200';     // 파란색 틴트
        default: return 'text-slate-200';        // 회색 틴트
    }
}