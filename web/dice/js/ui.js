// web/dice/js/ui.js

async function loadComponents() {
    const tabs = [
        {id:'tab-shop',file:'lobby_shop.html'},
        {id:'tab-deck',file:'lobby_deck.html'},
        {id:'tab-battle',file:'lobby_start.html'},
        {id:'tab-event',file:'lobby_event.html'},
        {id:'tab-clan',file:'lobby_clan.html'}
    ];
    await Promise.all(tabs.map(async(t)=>{
        try{
            const r=await fetch(t.file);
            if(r.ok) document.getElementById(t.id).innerHTML=await r.text();
        }catch(e){}
    }));
    // 컴포넌트 로드 후 초기화
    if(typeof initGameCanvas === 'function') initGameCanvas();
    if(typeof fetchMyResources === 'function') fetchMyResources();
}

// 탭 전환
const tabNames = ['shop','deck','battle','event','clan'];
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('text-blue-600',b.dataset.target===`tab-${name}`));
    
    if(name==='deck') fetchMyDice();
    if(name==='shop') fetchMyResources();
}

// 덱 그리드 렌더링
function renderDiceGrid(list) {
    const grid = document.getElementById('dice-list-grid'); if(!grid) return;
    const countEl = document.getElementById('dice-count'); grid.innerHTML = ""; let ownedCount = 0;
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    list.forEach(dice => {
        const isOwned = dice.class_level > 0;
        if(isOwned) ownedCount++;
        
        let isUpgradeable = false;
        // 해금(0렙)은 제외하고, 보유 중인 주사위의 강화(1렙 이상)만 초록색 테마 적용
        if (isOwned && dice.class_level > 0) {
            const reqCards = 5;
            const reqGold = dice.class_level * 1000;
            // 만렙(20) 아님 & 카드충분 & 골드충분
            if (dice.quantity >= reqCards && currentGold >= reqGold && dice.class_level < 20) {
                isUpgradeable = true;
            }
        }

        const iconHtml = renderDiceIcon(dice, "w-12 h-12");
        const rarityBgIcon = getRarityBgIcon(dice.rarity);
        const rarityDotColor = getRarityDotColor(dice.rarity);
        
        // [수정] 테두리: 파랑 -> 초록 (Green-500)
        // [수정] 레벨 뱃지: 회색 -> 초록색 배경 (text-white bg-green-500)
        let borderClass = 'border-slate-100';
        let levelBadgeClass = 'text-slate-600 bg-slate-100';
        let arrowHtml = '';

        if (isUpgradeable) {
            borderClass = 'border-green-500 ring-2 ring-green-200'; // 테두리 강조
            levelBadgeClass = 'text-white bg-green-500 shadow-sm';   // 레벨 뱃지 강조
            
            // [NEW] 좌측 상단 초록색 화살표 (펄스 효과)
            arrowHtml = `
                <div class="absolute top-1 left-1 z-20 arrow-float bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-green-200">
                    <i class="ri-arrow-up-double-line text-green-600 text-xs font-bold"></i>
                </div>
            `;
        }

        const cardHtml = `
        <div class="aspect-square w-full rounded-xl shadow-sm border-2 ${borderClass} flex flex-col items-center justify-center relative overflow-hidden transition-transform active:scale-95 cursor-pointer ${isOwned ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 dice-unowned'}" 
             onclick="showDiceDetail('${dice.id}')">
            
            ${arrowHtml}

            <div class="absolute inset-0 flex items-center justify-center text-slate-100 pointer-events-none -z-0">
                <i class="${rarityBgIcon} text-7xl opacity-50"></i>
            </div>
            
            <div class="mb-1 z-10 shrink-0">${iconHtml}</div>
            <div class="font-bold text-xs text-slate-700 z-10 truncate w-full text-center px-1 shrink-0">${dice.name}</div>
            
            ${isOwned ? `<span class="text-[10px] font-bold ${levelBadgeClass} px-1.5 rounded mt-1 z-10 shrink-0 transition-colors">Lv.${dice.class_level}</span>` : `<span class="text-[10px] font-bold text-slate-400 mt-1 z-10 shrink-0">미획득</span>`}
            
            ${isOwned ? `<span class="text-[9px] text-slate-400 absolute bottom-1 right-2 z-10">${dice.quantity}장</span>` : ""}
            <div class="absolute top-2 right-2 w-2 h-2 rounded-full ${rarityDotColor} z-10 shadow-sm"></div>
        </div>`;
        grid.innerHTML += cardHtml;
    });
    if(countEl) countEl.innerText = `${ownedCount}/${list.length}`;
}

// 상세 팝업
function showDiceDetail(diceId) {
    const dice = currentDiceList.find(d => d.id === diceId); if(!dice) return; currentSelectedDice = dice;
    
    document.getElementById('popup-dice-name').innerText = dice.name;
    document.getElementById('popup-dice-desc').innerText = dice.desc;
    document.getElementById('popup-dice-rarity').innerText = dice.rarity;
    document.getElementById('popup-dice-class').innerText = dice.class_level > 0 ? `Lv.${dice.class_level}` : "미보유";
    
    let iconHtml = renderDiceIcon(dice, "w-16 h-16");
    iconHtml = iconHtml.replace("text-4xl", "text-6xl"); 
    document.getElementById('popup-dice-icon-container').innerHTML = iconHtml;

    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;
    const btn = document.getElementById('popup-action-btn'); 
    const costInfo = document.getElementById('popup-cost-info'); 
    const progress = document.getElementById('popup-progress-bar');
    
    // 파티클 제거 (기존)
    const iconContainer = document.getElementById('popup-dice-icon-container');
    const existingParticles = iconContainer.querySelector('.firefly-container');
    if(existingParticles) existingParticles.remove();

    let canUpgrade = false, reqCards = 0, reqGold = 0;
    
    // [수정] 팝업 내부: 파란색 -> 초록색 테마 적용
    let btnColorClass = "bg-blue-600 hover:bg-blue-700"; // 기본 파랑 (강화불가 시 회색으로 덮어씀)
    let progColorClass = "bg-blue-500";

    currentViewMode = null; 

    if(dice.class_level === 0) { // 해금 (초록 유지)
        reqCards = 1; 
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`; 
        progress.style.width = `${Math.min((dice.quantity/reqCards)*100, 100)}%`;
        progress.className = `h-full w-0 transition-all duration-500 bg-green-500`; // 해금은 초록

        if(dice.quantity >= reqCards) { 
            canUpgrade = true; 
            btn.innerHTML = `<span>🔓 해금하기</span>`; 
            costInfo.innerText = "비용: 카드 1장"; 
            btnColorClass = "bg-green-500 hover:bg-green-600"; // 해금도 초록
        } else { 
            btn.innerHTML = `<span>카드 부족</span>`; 
            costInfo.innerText = "카드를 더 모으세요"; 
            btnColorClass = "bg-slate-300 cursor-not-allowed";
        }
    } 
    else if (dice.class_level >= 20) { // 만렙
        reqCards = 5; 
        document.getElementById('popup-dice-cards').innerText = "MAX";
        progress.style.width = "100%";
        progress.className = "h-full w-full bg-slate-300";
        canUpgrade = false;
        btn.innerHTML = `<span>MAX LEVEL</span>`;
        costInfo.innerText = "최고 레벨에 도달했습니다.";
        btnColorClass = "bg-slate-400 cursor-not-allowed";
    }
    else { // 강화 (여기서 파랑 -> 초록 변경)
        reqCards = 5; reqGold = dice.class_level * 1000; 
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`; 
        progress.style.width = `${Math.min((dice.quantity/reqCards)*100, 100)}%`;
        
        // [수정] 강화 가능 시 초록색 테마
        if(dice.quantity >= reqCards && currentGold >= reqGold) { 
            canUpgrade = true; 
            btn.innerHTML = `<span>⬆️ 레벨업</span>`; 
            costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드`;
            currentViewMode = 'class';
            
            btnColorClass = "bg-green-600 hover:bg-green-700"; // [변경] 파랑 -> 초록
            progColorClass = "bg-green-500";                   // [변경] 파랑 -> 초록
        }
        else { 
            // 강화 불가 시 (카드나 골드 부족) - 기존 로직 유지 (파란색 베이스에 회색 버튼)
            btn.innerHTML = dice.quantity < reqCards ? "카드 부족" : "골드 부족"; 
            costInfo.innerText = `필요: 카드 5장, ${reqGold.toLocaleString()} 골드`; 
            currentViewMode = 'class';
            btnColorClass = "bg-slate-300 cursor-not-allowed";
            // 게이지는 부족해도 채워진 만큼은 파란색(또는 초록색)으로 보여줌
            progColorClass = "bg-slate-400"; 
        }
        progress.className = `h-full w-0 transition-all duration-500 ${progColorClass}`;
    }

    // 버튼 클래스 적용
    btn.className = `relative w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 overflow-hidden ${btnColorClass}`;

    // 펄스 효과 교체 (btn-pulse -> btn-pulse-green)
    if(canUpgrade) {
        btn.classList.add('btn-pulse-green'); // [변경] 초록 펄스
    } else {
        btn.classList.remove('btn-pulse-green');
    }

    btn.onclick = canUpgrade ? () => upgradeDice(dice.id) : null; 
    btn.disabled = !canUpgrade;
    
    updateStatsView();
    document.getElementById('dice-popup').classList.remove('hidden'); 
    document.getElementById('dice-popup').classList.add('flex');
}

function closePopup() { 
    document.getElementById('dice-popup').classList.add('hidden'); 
    document.getElementById('dice-popup').classList.remove('flex'); 
    currentSelectedDice = null; 
}

function toggleViewMode(mode) { 
    currentViewMode = (currentViewMode === mode) ? null : mode; 
    updateStatsView(); 
}

function updateStatsView() {
    if(!currentSelectedDice) return;
    const dice = currentSelectedDice; const stats = dice.stats; const level = Math.max(1, dice.class_level);
    const grid = document.getElementById('popup-stats-grid'); grid.innerHTML = "";
    
    addStatBox(grid, "공격력", "ri-sword-fill", stats.atk, level);
    addStatBox(grid, "공격속도", "ri-speed-fill", stats.speed, level, "s");
    addStatBoxStatic(grid, "타겟", "ri-crosshair-2-fill", stats.target);
    
    if(stats.specials) { stats.specials.forEach(sp => { addStatBox(grid, sp.name, sp.icon, sp, level, "", sp.format); }); }
    
    // 빈칸 채우기
    const filled = 3 + (stats.specials ? stats.specials.length : 0);
    for(let i=filled; i<6; i++) { grid.innerHTML += `<div class="stat-box"><div class="text-slate-300 mx-auto text-xl">-</div></div>`; }
    
    // 버튼 상태
    const btnClass = document.getElementById('btn-view-class'); const btnPower = document.getElementById('btn-view-power');
    btnClass.className = `flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${currentViewMode==='class' ? 'bg-green-100 border-green-300 text-green-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`;
    btnPower.className = `flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${currentViewMode==='power' ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`;
}

function addStatBox(grid, name, iconClass, statData, level, unitSuffix="", formatStr="{}") {
    if(statData === "-" || !statData.base) { 
        grid.innerHTML += `<div class="stat-box justify-between"><i class="${iconClass} text-slate-400 text-lg w-6 text-center"></i><div class="text-right"><div class="text-[10px] text-slate-400 font-bold">${name}</div><div class="text-lg font-bold text-slate-300">-</div></div></div>`; return; 
    }
    const baseVal = statData.base; const cInc = statData.c || 0; const pInc = statData.p || 0;
    let currentVal = parseFloat((baseVal + (level - 1) * cInc).toFixed(2));
    let displayVal = currentVal; let diffHtml = "";
    
    const isMaxLevel = level >= 20;
    if (currentViewMode === 'class' && cInc !== 0 && !isMaxLevel) { diffHtml = `<span class="text-[10px] text-green-600 ml-1">(${cInc > 0 ? "+" : ""}${cInc})</span>`; }
    else if (currentViewMode === 'power' && pInc !== 0) { diffHtml = `<span class="text-[10px] text-orange-500 ml-1">(${pInc > 0 ? "+" : ""}${pInc})</span>`; }
    
    let finalStr = formatStr.replace("{}", displayVal); if(unitSuffix && !formatStr.includes(unitSuffix)) finalStr += unitSuffix;
    grid.innerHTML += `<div class="stat-box justify-between"><i class="${iconClass} text-slate-600 text-lg w-6 text-center"></i><div class="text-right"><div class="text-[10px] text-slate-400 font-bold">${name}</div><div class="text-sm font-bold text-slate-700 flex items-center justify-end">${finalStr} ${diffHtml}</div></div></div>`;
}

function addStatBoxStatic(grid, name, iconClass, val) { 
    grid.innerHTML += `<div class="stat-box justify-between"><i class="${iconClass} text-slate-600 text-lg w-6 text-center"></i><div class="text-right"><div class="text-[10px] text-slate-400 font-bold">${name}</div><div class="text-sm font-bold text-slate-700">${val}</div></div></div>`; 
}