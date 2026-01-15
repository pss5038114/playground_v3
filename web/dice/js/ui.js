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
    
    if(typeof fetchMyDice === 'function') fetchMyDice();
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
// [공통 헬퍼 함수]
// -----------------------------------------------------------

function closeSummonOverlay() {
    const overlay = document.getElementById('summon-overlay');
    overlay.classList.remove('flex');
    overlay.classList.add('hidden');
    
    const tapArea = document.getElementById('summon-tap-area');
    if(tapArea) {
        tapArea.classList.add('hidden');
        tapArea.style.zIndex = "0"; 
        tapArea.onclick = null;
    }

    const container = document.getElementById('summon-dice-container');
    if(container) container.classList.remove('dice-slide-up');
    
    fetchMyResources();
    fetchMyDice();
}

function getRarityConfig(rarity) {
    const map = {
        'Common': { color: '#94a3b8', icon: 'ri-focus-line', tailwind: 'text-slate-400' },
        'Rare':   { color: '#3b82f6', icon: 'ri-shield-line', tailwind: 'text-blue-500' },
        'Hero':   { color: '#a855f7', icon: 'ri-sword-line', tailwind: 'text-purple-500' },
        'Legend': { color: '#facc15', icon: 'ri-vip-crown-line', tailwind: 'text-yellow-400' }
    };
    return map[rarity] || map['Common'];
}

function checkIsNew(diceId) {
    if (!currentDiceList || currentDiceList.length === 0) return true;
    const existing = currentDiceList.find(d => d.id === diceId);
    return !existing || existing.class_level === 0;
}

// -----------------------------------------------------------
// [소환 메인 로직]
// -----------------------------------------------------------

async function handleSummon(count) {
    if (!currentDiceList || currentDiceList.length === 0) {
        await fetchMyDice();
    }

    const data = await summonDice(count);
    if (!data) return;

    if (count === 1) {
        const resultDice = data.results[0];
        let isNew = checkIsNew(resultDice.id);
        
        document.getElementById('single-summon-wrapper').classList.remove('hidden');
        document.getElementById('single-summon-wrapper').classList.add('flex');
        document.getElementById('multi-summon-wrapper').classList.add('hidden');
        document.getElementById('multi-summon-wrapper').classList.remove('flex');
        
        playSingleSummonAnimation(resultDice, isNew);
    } else {
        document.getElementById('single-summon-wrapper').classList.add('hidden');
        document.getElementById('single-summon-wrapper').classList.remove('flex');
        document.getElementById('multi-summon-wrapper').classList.remove('hidden');
        document.getElementById('multi-summon-wrapper').classList.add('flex');
        
        playMultiSummonAnimation(data.results);
    }
}

// ==========================================
// [1회 소환 애니메이션]
// ==========================================
function playSingleSummonAnimation(diceData, isNew) {
    const overlay = document.getElementById('summon-overlay');
    const container = document.getElementById('summon-dice-container');
    const textArea = document.getElementById('summon-text-area');
    const tapArea = document.getElementById('summon-tap-area');
    
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    textArea.classList.add('hidden');
    textArea.classList.remove('text-reveal');
    tapArea.classList.add('hidden');
    
    container.innerHTML = '';
    container.className = "relative w-32 h-32 transition-transform duration-500 cursor-default flex items-center justify-center pointer-events-auto"; 
    container.onclick = null;

    const rarityConfig = getRarityConfig(diceData.rarity);
    
    const hiddenDice = document.createElement('div');
    hiddenDice.className = `w-32 h-32 bg-slate-800 rounded-[22%] flex items-center justify-center shadow-2xl summon-drop relative z-10`;
    hiddenDice.style.boxShadow = `0 0 20px rgba(0,0,0,0.5)`;
    hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-6xl text-white opacity-50"></i>`;
    container.appendChild(hiddenDice);

    setTimeout(() => {
        const flash = document.createElement('div');
        flash.className = 'impact-flash'; 
        container.appendChild(flash);
        
        hiddenDice.style.backgroundColor = 'white';
        hiddenDice.style.border = `4px solid ${rarityConfig.color}`;
        hiddenDice.style.setProperty('--glow-color', rarityConfig.color);
        hiddenDice.classList.remove('summon-drop');
        hiddenDice.classList.add('summon-waiting');
        hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-7xl ${rarityConfig.tailwind}"></i>`;
        
        container.style.cursor = 'pointer';
        container.classList.add('cursor-pointer');
        container.onclick = () => revealDice(hiddenDice, diceData, isNew, rarityConfig);
    }, 600);
}

function revealDice(element, diceData, isNew, config) {
    const container = document.getElementById('summon-dice-container');
    container.onclick = null;
    container.style.cursor = 'default';
    element.classList.remove('summon-waiting');
    
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    container.appendChild(ripple);
    
    let realIconHtml = renderDiceIcon(diceData, "w-32 h-32");
    realIconHtml = realIconHtml.replace("text-4xl", "text-8xl"); 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    newDiceEl.classList.add('relative', 'z-10'); 
    
    const glowColor = diceData.color && diceData.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 30px ${glowColor}80`; 
    
    container.replaceChild(newDiceEl, element);
    
    if(isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-4 -right-4 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "NEW!";
        container.appendChild(badge);
    }

    setTimeout(() => {
        container.classList.add('dice-slide-up');
        const textArea = document.getElementById('summon-text-area');
        const diceName = document.getElementById('summon-dice-name');
        const tapArea = document.getElementById('summon-tap-area'); 
        
        diceName.innerText = diceData.name;
        diceName.style.color = config.color; 
        textArea.classList.remove('hidden');
        textArea.classList.add('text-reveal');
        
        tapArea.classList.remove('hidden');
        tapArea.style.zIndex = "50"; 
        tapArea.onclick = closeSummonOverlay;
    }, 600);
}


// ==========================================
// [11회 소환 애니메이션]
// ==========================================

function playMultiSummonAnimation(results) {
    const overlay = document.getElementById('summon-overlay');
    const gridContainer = document.getElementById('summon-grid-container');
    const skipBtn = document.getElementById('summon-skip-btn');
    const continueMsg = document.getElementById('summon-continue-msg');
    const tapArea = document.getElementById('summon-tap-area');

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    tapArea.classList.add('hidden'); 
    gridContainer.innerHTML = '';
    skipBtn.classList.remove('hidden');
    continueMsg.classList.add('hidden');

    const rows = [
        results.slice(0, 4), 
        results.slice(4, 7), 
        results.slice(7, 11) 
    ];

    let diceElements = []; 

    rows.forEach((rowDice, rowIndex) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'summon-row';
        
        rowDice.forEach((dice, colIndex) => {
            const isNew = checkIsNew(dice.id);
            const rarityConfig = getRarityConfig(dice.rarity);
            
            const wrapper = document.createElement('div');
            wrapper.className = "relative flex flex-col items-center group";
            
            const box = document.createElement('div');
            box.className = "relative w-20 h-20 bg-transparent flex items-center justify-center cursor-default"; 
            
            const outline = document.createElement('div');
            outline.className = "outline-box";
            const globalIndex = (rowIndex === 0 ? 0 : (rowIndex === 1 ? 4 : 7)) + colIndex;
            outline.style.animationDelay = `${globalIndex * 0.05}s`;
            box.appendChild(outline);

            const hiddenDice = document.createElement('div');
            hiddenDice.className = "absolute inset-0 bg-white rounded-[22%] flex items-center justify-center opacity-0 transform scale-0"; 
            hiddenDice.style.border = `3px solid ${rarityConfig.color}`;
            hiddenDice.style.boxShadow = `0 0 10px ${rarityConfig.color}`;
            hiddenDice.style.setProperty('--glow-color', rarityConfig.color);
            hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-4xl ${rarityConfig.tailwind}"></i>`;
            
            const appearDelay = 0.6 + (rowIndex * 0.3) + (colIndex * 0.05);
            hiddenDice.style.animation = `pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${appearDelay}s, breathe-glow 2s infinite ease-in-out ${appearDelay + 0.4}s`;
            box.appendChild(hiddenDice);
            
            const nameLabel = document.createElement('div');
            nameLabel.className = "absolute -bottom-4 text-[10px] font-bold text-white text-center opacity-0 w-24 truncate pointer-events-none";
            nameLabel.innerText = dice.name;
            
            wrapper.appendChild(box);
            wrapper.appendChild(nameLabel);
            rowEl.appendChild(wrapper);
            
            const diceObj = {
                id: dice.id,
                data: dice,
                isNew: isNew,
                elBox: box,
                elHidden: hiddenDice,
                elName: nameLabel,
                config: rarityConfig,
                isRevealed: false,
                appearTime: (appearDelay + 0.4) * 1000 
            };
            diceElements.push(diceObj);

            box.onclick = () => {
                if (!diceObj.isRevealed && Date.now() > startTime + diceObj.appearTime) {
                    revealMultiSingle(diceObj);
                    checkAllRevealed(diceElements);
                }
            };
        });
        gridContainer.appendChild(rowEl);
    });

    const startTime = Date.now();

    skipBtn.onclick = () => {
        skipBtn.classList.add('hidden'); 
        const unrevealed = diceElements.filter(d => !d.isRevealed);
        unrevealed.forEach((d, i) => {
            setTimeout(() => {
                revealMultiSingle(d);
                if (i === unrevealed.length - 1) checkAllRevealed(diceElements);
            }, i * 100); 
        });
    };
}

function revealMultiSingle(diceObj) {
    if (diceObj.isRevealed) return;
    diceObj.isRevealed = true;

    const { elBox, elHidden, elName, data, isNew, config } = diceObj;

    elBox.style.cursor = 'default';
    elHidden.classList.remove('summon-waiting'); 
    elHidden.style.animation = 'none';
    elHidden.style.opacity = '1';
    elHidden.style.transform = 'scale(1)';

    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    elBox.appendChild(ripple);

    let realIconHtml = renderDiceIcon(data, "w-20 h-20");
    realIconHtml = realIconHtml.replace("text-4xl", "text-5xl"); 
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    newDiceEl.classList.add('relative', 'z-10');
    
    const glowColor = data.color && data.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 15px ${glowColor}80`; 

    elBox.replaceChild(newDiceEl, elHidden);

    if (isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-3 -right-3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "N";
        elBox.appendChild(badge);
    }

    elName.classList.add('name-fade-in');
}

function checkAllRevealed(diceElements) {
    const allDone = diceElements.every(d => d.isRevealed);
    if (allDone) {
        const skipBtn = document.getElementById('summon-skip-btn');
        const continueMsg = document.getElementById('summon-continue-msg');
        const tapArea = document.getElementById('summon-tap-area');

        if(skipBtn) skipBtn.classList.add('hidden');
        if(continueMsg) continueMsg.classList.remove('hidden');
        
        if(tapArea) {
            tapArea.classList.remove('hidden');
            tapArea.style.zIndex = "50"; 
            tapArea.onclick = closeSummonOverlay;
        }
    }
}

// -----------------------------------------------------------
// [덱 및 팝업 로직]
// -----------------------------------------------------------

let isUpgradeJustHappened = false;

function closePopup() { 
    document.getElementById('dice-popup').classList.add('hidden'); 
    document.getElementById('dice-popup').classList.remove('flex'); 
    currentSelectedDice = null; 
}

function toggleViewMode(mode) { 
    currentViewMode = (currentViewMode === mode) ? null : mode; 
    updateStatsView(); 
}

// [renderDiceGrid 수정] (선택 모드 지원)
function renderDiceGrid(list, isSelectionMode = false) {
    const grid = document.getElementById('dice-list-grid'); if(!grid) return;
    const countEl = document.getElementById('dice-count'); grid.innerHTML = ""; let ownedCount = 0;
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    // 선택 모드일 때 z-index 높여서 오버레이 위로 올리기
    if(isSelectionMode) {
        grid.classList.add('relative', 'z-50');
    } else {
        grid.classList.remove('relative', 'z-50');
    }

    list.forEach(dice => {
        const isOwned = dice.class_level > 0;
        if(isOwned) ownedCount++;
        
        let isUpgradeable = false;
        // 일반 모드에서만 업그레이드 가능 여부 체크
        if (!isSelectionMode && dice.next_cost) {
            const { cards, gold } = dice.next_cost;
            if (dice.class_level > 0 && dice.quantity >= cards && currentGold >= gold) {
                isUpgradeable = true;
            }
        }

        const iconHtml = renderDiceIcon(dice, "w-12 h-12");
        const rarityBgIcon = getRarityBgIcon(dice.rarity);
        const rarityBgTextColor = getRarityBgTextColor(dice.rarity);
        const rarityDotColor = getRarityDotColor(dice.rarity);
        
        // 기본 스타일
        let borderClass = 'border-slate-100';
        let levelBadgeClass = 'text-slate-600 bg-slate-100';
        let arrowHtml = '';
        let onClickAction = `showDiceDetail('${dice.id}')`; // 기본: 상세 팝업
        let visualClass = "";

        // [분기] 선택 모드 vs 일반 모드
        if (isSelectionMode) {
            if (isOwned) {
                onClickAction = `equipDiceToSlot('${dice.id}')`; // 편집: 장착
                visualClass = "cursor-pointer transition-all hover:scale-95";
                
                // 덱에 이미 있는 주사위 표시 (선택 시 이동됨을 알림)
                if (myDeck.includes(dice.id)) {
                    borderClass = "border-blue-400 ring-2 ring-blue-100";
                    visualClass += " bg-blue-50"; 
                } else {
                    borderClass = "border-slate-200 hover:border-yellow-400 hover:ring-2 hover:ring-yellow-200";
                }
            } else {
                onClickAction = ""; // 미보유는 선택 불가
                visualClass = "opacity-40 cursor-not-allowed grayscale";
            }
        } else {
            // 일반 모드 (업그레이드 표시 등)
            if (isUpgradeable) {
                borderClass = 'border-green-500 ring-2 ring-green-200';
                levelBadgeClass = 'text-white bg-green-500 shadow-sm';
                arrowHtml = `<div class="absolute top-1 left-1 z-20 arrow-float bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-green-200"><i class="ri-arrow-up-double-line text-green-600 text-xs font-bold"></i></div>`;
            }
            visualClass = isOwned ? 'bg-white hover:bg-slate-50 cursor-pointer active:scale-95 transition-transform' : 'bg-slate-100 dice-unowned cursor-pointer';
        }

        const cardHtml = `
        <div class="aspect-square w-full rounded-xl shadow-sm border-2 ${borderClass} flex flex-col items-center justify-center relative overflow-hidden ${visualClass}" 
             onclick="${onClickAction}">
            
            ${isSelectionMode && myDeck.includes(dice.id) ? `<div class="absolute top-1 right-1 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold z-20">장착중</div>` : ""}
            ${arrowHtml}

            <div class="absolute inset-0 flex items-center justify-center ${rarityBgTextColor} pointer-events-none -z-0"><i class="${rarityBgIcon} text-7xl opacity-40"></i></div>
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

    // [수정] 반딧불(firefly) 관련 코드 삭제 (cleanup은 유지해도 무방)
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
        // [수정] firefly 추가하던 코드 삭제됨
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

let myDeck = [null, null, null, null, null];
let editingSlotIndex = -1; // -1이면 편집 모드 아님

// [Deck 탭 초기화]
async function initDeckTab() {
    myDeck = await fetchMyDeck();
    renderDeckSlots();
    // 덱 탭에 들어왔으니 보유 목록도 그리기 (편집 모드 지원을 위해)
    renderDiceGrid(currentDiceList); 
}

// [덱 슬롯 렌더링]
function renderDeckSlots() {
    const container = document.getElementById('equipped-deck');
    if(!container) return;
    
    container.innerHTML = "";
    
    myDeck.forEach((diceId, idx) => {
        const diceInfo = diceId ? currentDiceList.find(d => d.id === diceId) : null;
        
        // 슬롯 HTML
        const slotEl = document.createElement('div');
        // 높이 고정 (h-24 등)으로 내용물 유무에 따른 밀림 방지
        slotEl.className = `relative w-16 h-24 bg-slate-200 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${editingSlotIndex === idx ? 'border-yellow-400 ring-2 ring-yellow-200 z-50 scale-105' : 'border-slate-300 hover:border-blue-300'}`;
        
        // 클릭 이벤트
        slotEl.onclick = (e) => {
            e.stopPropagation();
            enterDeckEditMode(idx);
        };

        if (diceInfo) {
            const visual = renderDiceIcon(diceInfo, "w-10 h-10");
            // 이름과 레벨 표시
            slotEl.innerHTML = `
                <div class="mb-1 pointer-events-none">${visual}</div>
                <div class="text-[10px] font-bold text-slate-700 truncate w-full text-center px-1 leading-tight">${diceInfo.name}</div>
                <div class="text-[9px] font-bold text-slate-500">Lv.${diceInfo.class_level}</div>
            `;
            // 배경색을 흰색으로 (채워진 느낌)
            slotEl.classList.remove('bg-slate-200');
            slotEl.classList.add('bg-white');
        } else {
            // 빈 슬롯
            slotEl.innerHTML = `<i class="ri-add-line text-slate-400 text-2xl"></i>`;
        }
        
        container.appendChild(slotEl);
    });
}

// [편집 모드 진입]
function enterDeckEditMode(slotIdx) {
    editingSlotIndex = slotIdx;
    
    // 1. 딤 처리 (Overlay)
    let overlay = document.getElementById('deck-edit-overlay');
    if(!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'deck-edit-overlay';
        overlay.className = "absolute inset-0 bg-black/60 z-40 animate-[fadeIn_0.2s_ease-out]";
        // 오버레이 클릭 시 편집 취소
        overlay.onclick = exitDeckEditMode;
        // 덱 탭 컨테이너(main)에 추가 (relative여야 함)
        document.querySelector('main').appendChild(overlay);
    } else {
        overlay.classList.remove('hidden');
    }
    
    // 2. UI 갱신 (선택된 슬롯 강조, 하단 리스트를 위로 올리거나 강조)
    renderDeckSlots(); // 선택된 슬롯 테두리 노랑색 적용을 위해
    
    // 하단 주사위 리스트도 '선택 모드'로 갱신 (이벤트 핸들러 변경 등)
    renderDiceGrid(currentDiceList, true); // true = isSelectionMode
}

// [편집 모드 종료]
function exitDeckEditMode() {
    editingSlotIndex = -1;
    const overlay = document.getElementById('deck-edit-overlay');
    if(overlay) overlay.classList.add('hidden');
    
    renderDeckSlots();
    renderDiceGrid(currentDiceList, false);
}

// [주사위 장착/스왑 로직]
async function equipDiceToSlot(diceId) {
    if(editingSlotIndex === -1) return;
    
    const targetSlot = editingSlotIndex;
    const existingIndex = myDeck.indexOf(diceId); // 이미 덱에 있는지 확인
    
    if (existingIndex !== -1) {
        // [중복 케이스]
        if (existingIndex === targetSlot) {
            // 같은 자리를 또 누름 -> 해제? 아니면 그냥 유지? 
            // 보통 해제하거나 유지. 여기선 유지하고 종료.
        } else {
            // 다른 자리에 있음 -> 스왑(Swap) 또는 이동
            // targetSlot에 있던 놈
            const originalDiceInTarget = myDeck[targetSlot];
            
            // 이동: 기존 자리(existingIndex)에 targetSlot에 있던 놈을 넣음 (스왑)
            // 만약 targetSlot이 비어있었다면 null이 들어가서 이동 효과가 됨.
            myDeck[existingIndex] = originalDiceInTarget;
            myDeck[targetSlot] = diceId;
        }
    } else {
        // [신규 장착]
        myDeck[targetSlot] = diceId;
    }
    
    // 저장 및 UI 갱신
    await saveMyDeck(myDeck);
    exitDeckEditMode();
}