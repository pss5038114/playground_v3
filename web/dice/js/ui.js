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
    if(typeof initGameCanvas === 'function') initGameCanvas();
    if(typeof fetchMyResources === 'function') fetchMyResources();
}

const tabNames = ['shop','deck','battle','event','clan'];
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('text-blue-600',b.dataset.target===`tab-${name}`));
    
    if(name==='deck') fetchMyDice();
    if(name==='shop') fetchMyResources();
}

// -----------------------------------------------------------
// [소환 및 애니메이션 로직]
// -----------------------------------------------------------

async function handleSummon(count) {
    const data = await summonDice(count);
    if (!data) return;

    if (count === 1) {
        const resultDice = data.results[0];
        let isNew = true;
        if (currentDiceList.length > 0) {
            const existing = currentDiceList.find(d => d.id === resultDice.id);
            if (existing && existing.class_level > 0) isNew = false;
        }
        playSingleSummonAnimation(resultDice, isNew);
    } else {
        const names = data.results.map(x=>`[${x.rarity}] ${x.name}`).join("\n");
        alert(`✨ 소환 결과 (10+1) ✨\n\n${names}`);
        fetchMyResources();
        fetchMyDice();
    }
}

function playSingleSummonAnimation(diceData, isNew) {
    const overlay = document.getElementById('summon-overlay');
    const container = document.getElementById('summon-dice-container');
    const textArea = document.getElementById('summon-text-area');
    const tapArea = document.getElementById('summon-tap-area');
    
    // 초기화
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    textArea.classList.add('hidden');
    textArea.classList.remove('text-reveal');
    tapArea.classList.add('hidden');
    
    // 컨테이너 초기화
    container.innerHTML = '';
    container.className = "relative w-32 h-32 transition-transform duration-500 cursor-default flex items-center justify-center pointer-events-auto"; 
    container.onclick = null; 

    // 등급별 설정
    const rarityConfig = {
        'Common': { color: '#94a3b8', icon: 'ri-focus-line', tailwind: 'text-slate-400' },
        'Rare':   { color: '#3b82f6', icon: 'ri-shield-line', tailwind: 'text-blue-500' },
        'Hero':   { color: '#a855f7', icon: 'ri-sword-line', tailwind: 'text-purple-500' },
        'Legend': { color: '#facc15', icon: 'ri-vip-crown-line', tailwind: 'text-yellow-400' }
    };
    const config = rarityConfig[diceData.rarity] || rarityConfig['Common'];
    
    // 1. 미확인 주사위 생성 (하강)
    const hiddenDice = document.createElement('div');
    hiddenDice.className = `w-32 h-32 bg-slate-800 rounded-[22%] flex items-center justify-center shadow-2xl summon-drop relative z-10`;
    hiddenDice.style.boxShadow = `0 0 20px rgba(0,0,0,0.5)`;
    hiddenDice.innerHTML = `<i class="${config.icon} text-6xl text-white opacity-50"></i>`;
    
    container.appendChild(hiddenDice);

    // 2. 착지 후 대기 상태 (0.6초 후)
    setTimeout(() => {
        const flash = document.createElement('div');
        flash.className = 'impact-flash'; 
        container.appendChild(flash);
        
        hiddenDice.style.backgroundColor = 'white';
        hiddenDice.style.border = `4px solid ${config.color}`;
        hiddenDice.style.setProperty('--glow-color', config.color);
        hiddenDice.classList.remove('summon-drop');
        hiddenDice.classList.add('summon-waiting');
        
        hiddenDice.innerHTML = `<i class="${config.icon} text-7xl ${config.tailwind}"></i>`;
        
        container.style.cursor = 'pointer';
        container.classList.add('cursor-pointer');
        
        container.onclick = function() {
            revealDice(hiddenDice, diceData, isNew, config);
        };
        
    }, 600);
}

function revealDice(element, diceData, isNew, config) {
    const container = document.getElementById('summon-dice-container');

    // 1. 클릭 이벤트 제거 및 상태 초기화
    container.onclick = null;
    container.style.cursor = 'default';
    element.classList.remove('summon-waiting');
    
    // 2. 파동 효과
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    container.appendChild(ripple);
    
    // 3. 주사위 실체화 (즉시 교체)
    let realIconHtml = renderDiceIcon(diceData, "w-32 h-32");
    realIconHtml = realIconHtml.replace("text-4xl", "text-8xl"); 
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    
    newDiceEl.classList.add('relative', 'z-10'); 
    const glowColor = diceData.color && diceData.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 30px ${glowColor}80`; 
    
    container.replaceChild(newDiceEl, element);
    
    // NEW 뱃지
    if(isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-4 -right-4 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "NEW!";
        container.appendChild(badge);
    }

    // 4. [시퀀스] 파동 끝난 후 위로 이동 + 텍스트 등장 (0.6초 후)
    setTimeout(() => {
        container.classList.add('dice-slide-up');

        const textArea = document.getElementById('summon-text-area');
        const diceName = document.getElementById('summon-dice-name');
        const tapArea = document.getElementById('summon-tap-area');
        
        if(diceName) {
            diceName.innerText = diceData.name;
            diceName.style.color = config.color; 
        }
        
        if(textArea) {
            textArea.classList.remove('hidden');
            textArea.classList.add('text-reveal');
        }
        
        if(tapArea) {
            tapArea.classList.remove('hidden');
            tapArea.onclick = closeSummonOverlay;
        }
        
    }, 600);
}

function closeSummonOverlay() {
    const overlay = document.getElementById('summon-overlay');
    overlay.classList.remove('flex');
    overlay.classList.add('hidden');
    
    const container = document.getElementById('summon-dice-container');
    container.classList.remove('dice-slide-up');
    
    fetchMyResources();
    fetchMyDice();
}

// ... (renderDiceGrid, showDiceDetail 등 하단 로직은 기존과 동일) ...
function renderDiceGrid(list) {
    const grid = document.getElementById('dice-list-grid'); if(!grid) return;
    const countEl = document.getElementById('dice-count'); grid.innerHTML = ""; let ownedCount = 0;
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    list.forEach(dice => {
        const isOwned = dice.class_level > 0;
        if(isOwned) ownedCount++;
        
        let isUpgradeable = false;
        if (dice.next_cost) {
            const { cards, gold } = dice.next_cost;
            if (dice.class_level > 0 && dice.quantity >= cards && currentGold >= gold) {
                isUpgradeable = true;
            }
        }

        const iconHtml = renderDiceIcon(dice, "w-12 h-12");
        const rarityBgIcon = getRarityBgIcon(dice.rarity);
        const rarityDotColor = getRarityDotColor(dice.rarity);
        
        let borderClass = 'border-slate-100';
        let levelBadgeClass = 'text-slate-600 bg-slate-100';
        let arrowHtml = '';

        if (isUpgradeable) {
            borderClass = 'border-green-500 ring-2 ring-green-200';
            levelBadgeClass = 'text-white bg-green-500 shadow-sm';
            arrowHtml = `<div class="absolute top-1 left-1 z-20 arrow-float bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-green-200"><i class="ri-arrow-up-double-line text-green-600 text-xs font-bold"></i></div>`;
        }

        const cardHtml = `
        <div class="aspect-square w-full rounded-xl shadow-sm border-2 ${borderClass} flex flex-col items-center justify-center relative overflow-hidden transition-transform active:scale-95 cursor-pointer ${isOwned ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 dice-unowned'}" 
             onclick="showDiceDetail('${dice.id}')">
            ${arrowHtml}
            <div class="absolute inset-0 flex items-center justify-center text-slate-100 pointer-events-none -z-0"><i class="${rarityBgIcon} text-7xl opacity-50"></i></div>
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

function showDiceDetail(diceId) {
    const dice = currentDiceList.find(d => d.id === diceId); if(!dice) return; currentSelectedDice = dice;
    
    document.getElementById('popup-dice-name').innerText = dice.name;
    document.getElementById('popup-dice-desc').innerText = dice.desc;
    document.getElementById('popup-dice-rarity').innerText = dice.rarity;
    document.getElementById('popup-dice-class').innerText = dice.class_level > 0 ? `Lv.${dice.class_level}` : "미보유";
    
    let iconHtml = renderDiceIcon(dice, "w-16 h-16");
    iconHtml = iconHtml.replace("text-4xl", "text-6xl"); 
    document.getElementById('popup-dice-icon-container').innerHTML = iconHtml;

    const iconContainer = document.getElementById('popup-dice-icon-container');
    const existingParticles = iconContainer.querySelector('.firefly-container');
    if(existingParticles) existingParticles.remove();

    const btn = document.getElementById('popup-action-btn'); 
    const costInfo = document.getElementById('popup-cost-info'); 
    const progress = document.getElementById('popup-progress-bar');
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    let canUpgrade = false;
    let btnColorClass = "bg-blue-600 hover:bg-blue-700";
    let progColorClass = "bg-blue-500";
    
    currentViewMode = null;

    if (dice.class_level >= 20) {
        document.getElementById('popup-dice-cards').innerText = "MAX";
        progress.style.width = "100%";
        progress.className = "h-full w-full bg-slate-300";
        
        btn.innerHTML = `<span>MAX LEVEL</span>`;
        costInfo.innerText = "최고 레벨에 도달했습니다.";
        btnColorClass = "bg-slate-400 cursor-not-allowed";
        canUpgrade = false;
    } 
    else {
        const reqCards = dice.next_cost ? dice.next_cost.cards : 9999;
        const reqGold = dice.next_cost ? dice.next_cost.gold : 9999;
        
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`;
        const pct = Math.min((dice.quantity / reqCards) * 100, 100);
        progress.style.width = `${pct}%`;

        const hasEnoughCards = dice.quantity >= reqCards;
        const hasEnoughGold = currentGold >= reqGold;

        if (dice.class_level === 0) {
            progColorClass = "bg-green-500";
            if (hasEnoughCards && hasEnoughGold) {
                canUpgrade = true;
                btn.innerHTML = `<span>🔓 해금하기</span>`;
                costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드`;
                btnColorClass = "bg-green-500 hover:bg-green-600";
            } else {
                btn.innerHTML = !hasEnoughCards ? `<span>카드 부족</span>` : `<span>골드 부족</span>`;
                costInfo.innerText = !hasEnoughCards ? "카드를 더 모으세요" : `비용: ${reqGold.toLocaleString()} 골드`;
                btnColorClass = "bg-slate-300 cursor-not-allowed";
            }
        } else {
            if (hasEnoughCards && hasEnoughGold) {
                canUpgrade = true;
                currentViewMode = 'class'; 
                btn.innerHTML = `<span>⬆️ 레벨업</span>`;
                costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드`;
                
                btnColorClass = "bg-green-600 hover:bg-green-700"; 
                progColorClass = "bg-green-500";
            } else {
                currentViewMode = 'class'; 
                btn.innerHTML = !hasEnoughCards ? `카드 부족` : `골드 부족`;
                costInfo.innerText = `필요: 카드 ${reqCards}장, ${reqGold.toLocaleString()} 골드`;
                btnColorClass = "bg-slate-300 cursor-not-allowed";
                progColorClass = "bg-slate-400";
            }
        }
        progress.className = `h-full w-0 transition-all duration-500 ${progColorClass}`;
    }

    btn.className = `relative w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 overflow-hidden ${btnColorClass}`;

    if(canUpgrade) {
        btn.classList.add('btn-pulse-green');
        iconContainer.innerHTML += `<div class="firefly-container" style="border-radius: 1rem;"><div class="firefly"></div><div class="firefly"></div></div>`;
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
    
    const filled = 3 + (stats.specials ? stats.specials.length : 0);
    for(let i=filled; i<6; i++) { grid.innerHTML += `<div class="stat-box"><div class="text-slate-300 mx-auto text-xl">-</div></div>`; }
    
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