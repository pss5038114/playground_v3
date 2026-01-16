// web/dice/js/utils.js

// 비동기 대기
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 캔버스 그리기 헬퍼
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

// --- [이동됨] 주사위 아이콘/색상 관련 유틸리티 ---

function getRarityBgIcon(rarity) {
    switch (rarity) {
        case 'Legend': return 'ri-vip-diamond-fill';
        case 'Hero': return 'ri-shield-star-fill';
        case 'Rare': return 'ri-star-smile-fill';
        default: return 'ri-circle-fill';
    }
}

function getRarityBgTextColor(rarity) {
    switch (rarity) {
        case 'Legend': return 'text-yellow-100'; // 골드 느낌
        case 'Hero': return 'text-purple-100';
        case 'Rare': return 'text-blue-100';
        default: return 'text-slate-100';
    }
}

function getRarityDotColor(rarity) {
    switch (rarity) {
        case 'Legend': return 'bg-yellow-400 border border-yellow-200';
        case 'Hero': return 'bg-purple-400 border border-purple-200';
        case 'Rare': return 'bg-blue-400 border border-blue-200';
        default: return 'bg-slate-300 border border-slate-100';
    }
}

// 주사위 아이콘 HTML 생성 (로비/인게임 공용)
function renderDiceIcon(dice, sizeClass="w-12 h-12") {
    // dice 객체가 없거나 정보가 부족할 때 대비
    if (!dice) return `<div class="${sizeClass} bg-slate-200 rounded-lg"></div>`;
    
    // symbol이 없으면 기본 아이콘 사용
    const symbol = dice.symbol || 'ri-question-mark'; 
    const colorClass = dice.color || 'bg-slate-400';
    
    // 폰트 크기는 박스 크기에 비례하게 (Tailwind 클래스 파싱이 어려우므로 대략적 처리)
    let textClass = "text-2xl";
    if (sizeClass.includes("w-16")) textClass = "text-4xl";
    if (sizeClass.includes("w-8")) textClass = "text-lg";

    // 그라데이션 여부 체크 (bg-gradient... 포함 시 그대로 사용, 아니면 bg- 색상 사용)
    const bgStyle = colorClass.includes('gradient') ? colorClass : colorClass;

    return `
    <div class="${sizeClass} rounded-xl ${bgStyle} flex items-center justify-center shadow-inner relative overflow-hidden ring-1 ring-black/5 dice-icon-box">
        <div class="absolute inset-0 bg-white/20"></div>
        <div class="absolute -bottom-4 -right-4 w-8 h-8 bg-white/30 rounded-full blur-xl"></div>
        <i class="${symbol} ${textClass} text-white drop-shadow-md relative z-10"></i>
    </div>`;
}

// 전역 등록
window.sleep = sleep;
window.drawRoundedRect = drawRoundedRect;
window.renderDiceIcon = renderDiceIcon;
window.getRarityBgIcon = getRarityBgIcon;
window.getRarityBgTextColor = getRarityBgTextColor;
window.getRarityDotColor = getRarityDotColor;