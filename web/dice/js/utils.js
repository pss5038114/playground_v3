// web/dice/js/utils.js

function getDiceVisualClasses(dice) {
    let borderColor = dice.color.replace('bg-', 'border-');
    if(dice.color.includes('gradient')) borderColor = 'border-slate-300';
    let effectClasses = "dice-glossy"; let customStyle = "";
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
    // [수정] 텍스트 크기: 부모 폰트 사이즈 상속을 위해 text-4xl 제거하고 sizeClass에 의존하거나, 외부에서 replace로 제어
    // 여기서는 기본값을 주고, 외부에서 replace 하는 방식을 유지합니다.
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 text-slate-400 z-0"><i class="${symbolIcon} text-4xl"></i></div>`;
    return `<div class="dice-face ${sizeClass} ${borderBase} ${borderColor} ${effectClasses}" style="${customStyle}">${bgSymbolHtml}<div class="dice-content w-[25%] h-[25%] rounded-full ${dice.color} shadow-sm z-10"></div></div>`;
}

function getRarityBgIcon(rarity) {
    switch(rarity) { case 'Legend': return 'ri-vip-crown-line'; case 'Hero': return 'ri-sword-line'; case 'Rare': return 'ri-shield-line'; default: return 'ri-focus-line'; }
}

function getRarityDotColor(rarity) {
    switch(rarity) { case 'Legend': return 'bg-yellow-400'; case 'Hero': return 'bg-purple-500'; case 'Rare': return 'bg-blue-500'; default: return 'bg-gray-400'; }
}