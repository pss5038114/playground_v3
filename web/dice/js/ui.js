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
        if (isOwned) {
            const reqCards = dice.class_level === 0 ? 1 : 5;
            const reqGold = dice.class_level * 1000;
            if (dice.quantity >= reqCards && (dice.class_level === 0 || currentGold >= reqGold) && dice.class_level < 20) {
                isUpgradeable = true;
            }
        }

        const iconHtml = renderDiceIcon(dice, "w-12 h-12");
        const rarityBgIcon = getRarityBgIcon(dice.rarity);
        const rarityDotColor = getRarityDotColor(dice.rarity);
        const borderClass = isUpgradeable ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-100';

        const cardHtml = `
        <div class="aspect-square w-full rounded-xl shadow-sm border-2 ${borderClass} flex flex-col items-center justify-center relative overflow-hidden transition-transform active:scale-95 cursor-pointer ${isOwned ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 dice-unowned'}" 
             onclick="showDiceDetail('${dice.id}')">
            <div class="absolute inset-0 flex items-center justify-center text-slate-100 pointer-events-none -z-0">
                <i class="${rarityBgIcon} text-7xl opacity-50"></i>
            </div>
            <div class="mb-1 z-10 shrink-0">${iconHtml}</div>
            <div class="font-bold text-xs text-slate-700 z-10 truncate w-full text-center px-1 shrink-0">${dice.name}</div>
            ${isOwned ? `<span class="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 rounded mt-1 z-10 shrink-0">Lv.${dice.class_level}</span>` : `<span class="text-[10px] font-bold text-slate-400 mt-1 z-10 shrink-0">미획득</span>`}
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
    
    // 텍스트 바인딩
    document.getElementById('popup-dice-name').innerText = dice.name;
    document.getElementById('popup-dice-desc').innerText = dice.desc;
    document.getElementById('popup-dice-rarity').innerText = dice.rarity;
    document.getElementById('popup-dice-class').innerText = dice.class_level > 0 ? `Lv.${dice.class_level}` : "미보유";
    
    // 아이콘 바인딩
    let iconHtml = renderDiceIcon(dice, "w-16 h-16");
    iconHtml = iconHtml.replace("text-4xl", "text-6xl"); 
    document.getElementById('popup-dice-icon-container').innerHTML = iconHtml;

    // 업그레이드 조건 체크
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;
    const btn = document.getElementById('popup-action-btn'); 
    const costInfo = document.getElementById('popup-cost-info'); 
    const progress = document.getElementById('popup-progress-bar');
    
    let canUpgrade = false, reqCards = 0, reqGold = 0;
    
    // 뷰 모드 초기화
    currentViewMode = null; 

    if(dice.class_level === 0) { // 해금
        reqCards = 1; 
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`; 
        progress.style.width = `${Math.min((dice.quantity/reqCards)*100, 100)}%`;
        if(dice.quantity >= reqCards) { 
            canUpgrade = true; 
            btn.className = "w-full py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600"; 
            btn.innerHTML = `<span>🔓 해금하기</span>`; 
            costInfo.innerText = "비용: 카드 1장"; 
        } else { 
            btn.className = "w-full py-3 rounded-xl font-bold text-white shadow-lg bg-slate-300 cursor-not-allowed"; 
            btn.innerHTML = `<span>카드 부족</span>`; 
            costInfo.innerText = "카드를 더 모으세요"; 
        }
    } 
    else if (dice.class_level >= 20) { // 만렙
        reqCards = 5; 
        document.getElementById('popup-dice-cards').innerText = "MAX";
        progress.style.width = "100%";
        canUpgrade = false;
        btn.className = "w-full py-3 rounded-xl font-bold text-white shadow-lg bg-slate-400 cursor-not-allowed";
        btn.innerHTML = `<span>MAX LEVEL</span>`;
        costInfo.innerText = "최고 레벨에 도달했습니다.";
        currentViewMode = null;
    }
    else { // 강화
        reqCards = 5; reqGold = dice.class_level * 1000; 
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`; 
        progress.style.width = `${Math.min((dice.quantity/reqCards)*100, 100)}%`;
        
        if(dice.quantity >= reqCards && currentGold >= reqGold) { 
            canUpgrade = true; 
            btn.className = "w-full py-3 rounded-xl font-bold text-white shadow-lg active:scale-95 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"; 
            btn.innerHTML = `<span>⬆️ 레벨업</span>`; 
            costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드`;
            currentViewMode = 'class'; // 미리보기 활성화
        }
        else { 
            btn.className = "w-full py-3 rounded-xl font-bold text-white shadow-lg bg-slate-300 cursor-not-allowed"; 
            btn.innerHTML = dice.quantity < reqCards ? "카드 부족" : "골드 부족"; 
            costInfo.innerText = `필요: 카드 5장, ${reqGold.toLocaleString()} 골드`; 
            currentViewMode = 'class';
        }
    }

    // 버튼 펄스 효과
    if(canUpgrade) btn.classList.add('btn-pulse');
    else btn.classList.remove('btn-pulse');

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