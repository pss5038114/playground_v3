// web/dice/js/ui_deck.js

// 방금 업그레이드 했는지 확인하는 상태 변수
let isUpgradeJustHappened = false;

function renderDeckSlots() {
    const container = document.getElementById('deck-slots-container');
    if (!container) return;
    
    container.innerHTML = "";
    let totalLevel = 0;

    myDeck.forEach((diceId, index) => {
        // 주사위 정보 찾기 (없으면 기본값 처리)
        let dice = currentDiceList.find(d => d.id === diceId);
        
        // 데이터가 아직 로드 안 됐거나 없는 경우 (가짜 데이터로 형태 유지)
        if (!dice) {
            // 초기 로딩 시점 등 예외 처리
            dice = { id: diceId, name: 'Loading', class_level: 1, rarity: 'Common', color: 'bg-slate-300' };
        }
        
        totalLevel += dice.class_level;

        // 선택된 슬롯인지 확인
        const isSelected = (index === selectedDeckSlot);
        const borderClass = isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200';
        const bgClass = isSelected ? 'bg-blue-50' : 'bg-slate-50';

        // 아이콘 렌더링 (작은 사이즈)
        const iconHtml = renderDiceIcon(dice, "w-10 h-10"); // w-10 = 40px

        const slotHtml = `
        <div onclick="selectDeckSlot(${index})" 
             class="relative flex-1 flex flex-col items-center justify-center p-1 rounded-xl border-2 ${borderClass} ${bgClass} cursor-pointer transition-all active:scale-95 aspect-[3/4]">
            
            <div class="mb-1 pointer-events-none">${iconHtml}</div>
            
            <div class="text-[10px] font-bold text-slate-700 w-full text-center truncate px-0.5 pointer-events-none">
                ${dice.name}
            </div>
            <div class="text-[9px] font-bold text-slate-500 bg-white/50 px-1.5 rounded pointer-events-none">
                Lv.${dice.class_level}
            </div>
            
            ${isSelected ? `<div class="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm animate-bounce"></div>` : ''}
        </div>
        `;
        container.innerHTML += slotHtml;
    });

    // 평균 레벨 표시
    const avgEl = document.getElementById('deck-avg-class');
    if(avgEl) avgEl.innerText = `평균 Lv.${(totalLevel / 5).toFixed(1)}`;
}

// [NEW] 슬롯 선택 함수
function selectDeckSlot(index) {
    if (selectedDeckSlot === index) {
        selectedDeckSlot = -1; // 이미 선택된거 누르면 해제
    } else {
        selectedDeckSlot = index;
    }
    renderDeckSlots(); // 테두리 갱신
    renderDiceGrid(currentDiceList); // 덱에 포함된 주사위 표시 갱신 (선택사항)
}

// [NEW] 주사위 클릭 핸들러 (그리드에서 호출)
function handleDiceClick(diceId) {
    // 1. 슬롯이 선택되어 있다면 -> 장착/교체 시도
    if (selectedDeckSlot !== -1) {
        equipDice(diceId);
    } 
    // 2. 슬롯 선택 안됨 -> 상세 정보 팝업
    else {
        showDiceDetail(diceId);
    }
}

// [NEW] 장착/교체 로직 (Swap 방식)
function equipDice(newDiceId) {
    const dice = currentDiceList.find(d => d.id === newDiceId);
    
    // 미보유 주사위 체크
    if (!dice || dice.class_level === 0) {
        alert("보유하지 않은 주사위입니다.");
        return;
    }

    // 이미 덱에 있는지 확인
    const existingIndex = myDeck.indexOf(newDiceId);

    if (existingIndex !== -1) {
        // [CASE 1] 이미 덱에 있는 주사위 -> 서로 위치 교환 (Swap)
        // 현재 선택된 슬롯의 주사위
        const temp = myDeck[selectedDeckSlot];
        myDeck[selectedDeckSlot] = newDiceId;
        myDeck[existingIndex] = temp;
    } else {
        // [CASE 2] 덱에 없는 주사위 -> 그냥 교체 (Replace)
        myDeck[selectedDeckSlot] = newDiceId;
    }

    // 선택 해제 및 UI 갱신
    selectedDeckSlot = -1;
    renderDeckSlots();
    
    // (선택사항) 변경된 덱 정보를 서버에 저장하는 로직이 여기에 들어가야 함
    // saveDeckToServer(); 
}

// 덱 그리드 렌더링
function renderDiceGrid(list) {
    const grid = document.getElementById('dice-list-grid'); if(!grid) return;
    const countEl = document.getElementById('dice-count'); grid.innerHTML = ""; let ownedCount = 0;
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    // [NEW] 덱 UI도 같이 갱신 (데이터 로드 시점 동기화)
    renderDeckSlots();

    list.forEach(dice => {
        const isOwned = dice.class_level > 0;
        if(isOwned) ownedCount++;
        
        // 덱에 포함된 주사위인지 확인 (시각적 표시용)
        const isInDeck = myDeck.includes(dice.id);
        
        let isUpgradeable = false;
        if (dice.next_cost) {
            const { cards, gold } = dice.next_cost;
            if (dice.class_level > 0 && dice.quantity >= cards && currentGold >= gold) {
                isUpgradeable = true;
            }
        }

        const iconHtml = renderDiceIcon(dice, "w-12 h-12");
        const rarityBgIcon = getRarityBgIcon(dice.rarity);
        const rarityBgTextColor = getRarityBgTextColor(dice.rarity);
        const rarityDotColor = getRarityDotColor(dice.rarity);
        
        let borderClass = 'border-slate-100';
        let levelBadgeClass = 'text-slate-600 bg-slate-100';
        let arrowHtml = '';

        // [수정] 덱에 장착 중이면 테두리나 배경으로 표시
        if (isInDeck) {
            borderClass = 'border-slate-400 bg-slate-50 ring-2 ring-slate-100'; // 장착 중 표시
        }

        if (isUpgradeable) {
            borderClass = 'border-green-500 ring-2 ring-green-200';
            levelBadgeClass = 'text-white bg-green-500 shadow-sm';
            arrowHtml = `<div class="absolute top-1 left-1 z-20 arrow-float bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-green-200"><i class="ri-arrow-up-double-line text-green-600 text-xs font-bold"></i></div>`;
        }

        // [수정] onclick 이벤트를 handleDiceClick으로 변경
        const cardHtml = `
        <div class="aspect-square w-full rounded-xl shadow-sm border-2 ${borderClass} flex flex-col items-center justify-center relative overflow-hidden transition-transform active:scale-95 cursor-pointer ${isOwned ? 'bg-white hover:bg-slate-50' : 'bg-slate-100 dice-unowned'}" 
             onclick="handleDiceClick('${dice.id}')">
            ${arrowHtml}
            
            ${isInDeck ? `<div class="absolute top-1 right-1 bg-slate-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded z-20">E</div>` : ''}

            <div class="absolute inset-0 flex items-center justify-center ${rarityBgTextColor} pointer-events-none -z-0"><i class="${rarityBgIcon} text-7xl opacity-40"></i></div>
            <div class="mb-1 z-10 shrink-0">${iconHtml}</div>
            <div class="font-bold text-xs text-slate-700 z-10 truncate w-full text-center px-1 shrink-0">${dice.name}</div>
            ${isOwned ? `<span class="text-[10px] font-bold ${levelBadgeClass} px-1.5 rounded mt-1 z-10 shrink-0 transition-colors">Lv.${dice.class_level}</span>` : `<span class="text-[10px] font-bold text-slate-400 mt-1 z-10 shrink-0">미획득</span>`}
            ${!isInDeck && isOwned ? `<span class="text-[9px] text-slate-400 absolute bottom-1 right-2 z-10">${dice.quantity}장</span>` : ""}
            <div class="absolute top-2 right-2 w-2 h-2 rounded-full ${rarityDotColor} z-10 shadow-sm"></div>
        </div>`;
        grid.innerHTML += cardHtml;
    });
    if(countEl) countEl.innerText = `${ownedCount}/${list.length}`;
}

// 상세 팝업 표시
function showDiceDetail(diceId) {
    const dice = currentDiceList.find(d => d.id === diceId); if(!dice) return; currentSelectedDice = dice;
    
    document.getElementById('popup-dice-name').innerText = dice.name;
    document.getElementById('popup-dice-desc').innerText = dice.desc;
    document.getElementById('popup-dice-rarity').innerText = dice.rarity;
    document.getElementById('popup-dice-class').innerText = dice.class_level > 0 ? `Lv.${dice.class_level}` : "미보유";
    
    let iconHtml = renderDiceIcon(dice, "w-16 h-16");
    iconHtml = iconHtml.replace("text-4xl", "text-6xl"); 
    document.getElementById('popup-dice-icon-container').innerHTML = iconHtml;

    // 파티클 초기화
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
    } else {
        btn.classList.remove('btn-pulse-green');
    }

    btn.onclick = canUpgrade ? () => upgradeDice(dice.id) : null; 
    btn.disabled = !canUpgrade;
    
    updateStatsView();
    document.getElementById('dice-popup').classList.remove('hidden'); 
    document.getElementById('dice-popup').classList.add('flex');
}

async function upgradeDice(diceId) {
    try {
        const res = await fetch(`${API_DICE}/upgrade`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username: myId, dice_id: diceId }) });
        const data = await res.json();
        if(res.ok) {
            const btn = document.getElementById('popup-action-btn');
            btn.classList.add('burst-effect');
            setTimeout(() => btn.classList.remove('burst-effect'), 600);
            
            isUpgradeJustHappened = true;
            
            await fetchMyResources();
            const listRes = await fetch(`${API_DICE}/list/${myId}`);
            if(listRes.ok) {
                currentDiceList = await listRes.json();
                renderDiceGrid(currentDiceList); 
                const updatedDice = currentDiceList.find(d => d.id === diceId);
                if(updatedDice) {
                    currentSelectedDice = updatedDice;
                    document.getElementById('popup-dice-class').innerText = `Lv.${updatedDice.class_level}`;
                    showDiceDetail(diceId);
                }
            }
        } else { alert(data.detail || "오류"); }
    } catch(e) { alert("통신 오류"); }
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
    
    isUpgradeJustHappened = false;
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
    
    let arrowHtml = "";
    if (isUpgradeJustHappened && cInc !== 0) {
        arrowHtml = `<div class="stat-up-arrow"><i class="ri-arrow-up-double-line"></i></div>`;
    }

    let finalStr = formatStr.replace("{}", displayVal); if(unitSuffix && !formatStr.includes(unitSuffix)) finalStr += unitSuffix;
    grid.innerHTML += `<div class="stat-box justify-between"><i class="${iconClass} text-slate-600 text-lg w-6 text-center"></i>${arrowHtml}<div class="text-right"><div class="text-[10px] text-slate-400 font-bold">${name}</div><div class="text-sm font-bold text-slate-700 flex items-center justify-end">${finalStr} ${diffHtml}</div></div></div>`;
}

function addStatBoxStatic(grid, name, iconClass, val) { 
    grid.innerHTML += `<div class="stat-box justify-between"><i class="${iconClass} text-slate-600 text-lg w-6 text-center"></i><div class="text-right"><div class="text-[10px] text-slate-400 font-bold">${name}</div><div class="text-sm font-bold text-slate-700">${val}</div></div></div>`; 
}