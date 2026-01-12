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
        // [1회 소환]
        const resultDice = data.results[0];
        let isNew = checkIsNew(resultDice.id);
        
        // 래퍼 전환
        document.getElementById('single-summon-wrapper').classList.remove('hidden');
        document.getElementById('single-summon-wrapper').classList.add('flex');
        document.getElementById('multi-summon-wrapper').classList.add('hidden');
        document.getElementById('multi-summon-wrapper').classList.remove('flex');
        
        playSingleSummonAnimation(resultDice, isNew);
    } else {
        // [11회 소환]
        document.getElementById('single-summon-wrapper').classList.add('hidden');
        document.getElementById('single-summon-wrapper').classList.remove('flex');
        document.getElementById('multi-summon-wrapper').classList.remove('hidden');
        document.getElementById('multi-summon-wrapper').classList.add('flex');
        
        playMultiSummonAnimation(data.results);
    }
}

function checkIsNew(diceId) {
    if (currentDiceList.length === 0) return true;
    const existing = currentDiceList.find(d => d.id === diceId);
    // 내 목록에 없거나, 있어도 레벨이 0이면 New
    return !existing || existing.class_level === 0;
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
    const rarityConfig = getRarityConfig(diceData.rarity);
    const config = rarityConfig[diceData.rarity] || rarityConfig['Common'];
    
    // 1. 미확인 주사위 생성 (하강)
    const hiddenDice = document.createElement('div');
    hiddenDice.className = `w-32 h-32 bg-slate-800 rounded-[22%] flex items-center justify-center shadow-2xl summon-drop relative z-10`;
    hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-6xl text-white opacity-50"></i>`;
    container.appendChild(hiddenDice);

    // 2. 착지 후 대기 상태 (0.6초 후)
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
        const tapArea = document.getElementById('summon-tap-area'); // 전체 닫기 영역
        
        diceName.innerText = diceData.name;
        diceName.style.color = config.color; 
        textArea.classList.remove('hidden');
        textArea.classList.add('text-reveal');
        
        tapArea.classList.remove('hidden');
        tapArea.onclick = closeSummonOverlay;
    }, 600);
}

// ==========================================
// [11회 소환 로직] (NEW)
// ==========================================

function playMultiSummonAnimation(results) {
    const overlay = document.getElementById('summon-overlay');
    const gridContainer = document.getElementById('summon-grid-container');
    const skipBtn = document.getElementById('summon-skip-btn');
    const continueMsg = document.getElementById('summon-continue-msg');
    const tapArea = document.getElementById('summon-tap-area');

    // 초기화
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    tapArea.classList.add('hidden'); // 아직 닫기 안됨
    gridContainer.innerHTML = '';
    skipBtn.classList.remove('hidden');
    continueMsg.classList.add('hidden');

    // 4-3-4 배치용 배열 분할
    const rows = [
        results.slice(0, 4), // 0~3
        results.slice(4, 7), // 4~6
        results.slice(7, 11) // 7~10
    ];

    let diceElements = []; // 나중에 스킵이나 체크를 위해 요소 저장

    // 그리드 생성
    rows.forEach((rowDice, rowIndex) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'summon-row'; // flex justify-center gap-3
        
        rowDice.forEach((dice, colIndex) => {
            const isNew = checkIsNew(dice.id);
            const rarityConfig = getRarityConfig(dice.rarity);
            
            // 주사위 래퍼 (이름 포함)
            const wrapper = document.createElement('div');
            wrapper.className = "relative flex flex-col items-center group"; // w-20 정도 크기?
            
            // 주사위 박스 (72px = w-18 정도)
            const box = document.createElement('div');
            box.className = "relative w-20 h-20 bg-transparent flex items-center justify-center cursor-default"; // 초기엔 투명
            
            // 1. 흰색 테두리 (그리기 애니메이션)
            const outline = document.createElement('div');
            outline.className = "outline-box";
            // 순차적 실행 (약간의 랜덤성 or 순서대로)
            // 전체 11개가 시계방향으로 지잉~ 그려짐
            // 단순하게 순서대로: index * 0.05s
            const globalIndex = (rowIndex === 0 ? 0 : (rowIndex === 1 ? 4 : 7)) + colIndex;
            outline.style.animationDelay = `${globalIndex * 0.05}s`;
            box.appendChild(outline);

            // 2. 등급 박스 (숨김 -> 팡! 등장)
            // 테두리가 다 그려질 즈음(0.5s 후)부터 줄별로 팡팡팡
            const hiddenDice = document.createElement('div');
            hiddenDice.className = "absolute inset-0 bg-white rounded-[22%] flex items-center justify-center opacity-0 transform scale-0"; // 초기 숨김
            hiddenDice.style.border = `3px solid ${rarityConfig.color}`;
            hiddenDice.style.boxShadow = `0 0 10px ${rarityConfig.color}`;
            hiddenDice.style.setProperty('--glow-color', rarityConfig.color);
            
            hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-4xl ${rarityConfig.tailwind}"></i>`;
            
            // 줄별 딜레이: 윗줄(0.6s) -> 중간(0.9s) -> 아랫줄(1.2s)
            const appearDelay = 0.6 + (rowIndex * 0.3) + (colIndex * 0.05);
            hiddenDice.style.animation = `pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${appearDelay}s, breathe-glow 2s infinite ease-in-out ${appearDelay + 0.4}s`;
            
            box.appendChild(hiddenDice);
            
            // 이름 레이블 (초기 숨김)
            const nameLabel = document.createElement('div');
            nameLabel.className = "absolute -bottom-6 text-[10px] font-bold text-white text-center opacity-0 w-24 truncate pointer-events-none";
            nameLabel.innerText = dice.name;
            // nameLabel.style.color = rarityConfig.color; // 원하면 등급색
            
            wrapper.appendChild(box);
            wrapper.appendChild(nameLabel);
            rowEl.appendChild(wrapper);
            
            // 데이터 저장
            const diceObj = {
                id: dice.id,
                data: dice,
                isNew: isNew,
                elBox: box,
                elHidden: hiddenDice,
                elName: nameLabel,
                config: rarityConfig,
                isRevealed: false,
                appearTime: (appearDelay + 0.4) * 1000 // 등장 완료 시간 (ms)
            };
            diceElements.push(diceObj);

            // 클릭 이벤트 (등장 시간 이후에만 가능하도록 처리 필요하지만, 
            // 간단하게는 pointer-events로 제어하거나 JS에서 체크)
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

    // 스킵 버튼
    skipBtn.onclick = () => {
        skipBtn.classList.add('hidden'); // 누르면 사라짐
        // 미공개된 것들 순차 공개 (빠르게)
        const unrevealed = diceElements.filter(d => !d.isRevealed);
        unrevealed.forEach((d, i) => {
            setTimeout(() => {
                revealMultiSingle(d);
                if (i === unrevealed.length - 1) checkAllRevealed(diceElements);
            }, i * 100); // 0.1초 간격 두두두두
        });
    };
}

function revealMultiSingle(diceObj) {
    if (diceObj.isRevealed) return;
    diceObj.isRevealed = true;

    const { elBox, elHidden, elName, data, isNew, config } = diceObj;

    // 1. 대기 애니메이션 제거 및 클릭 방지
    elBox.style.cursor = 'default';
    elHidden.classList.remove('summon-waiting'); // 숨쉬기 끔
    elHidden.style.animation = 'none';
    elHidden.style.opacity = '1';
    elHidden.style.transform = 'scale(1)';

    // 2. 파동
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    elBox.appendChild(ripple);

    // 3. 주사위 교체
    let realIconHtml = renderDiceIcon(data, "w-20 h-20");
    // 멀티 소환은 크기가 작으므로 text-4xl 유지하거나 text-5xl 정도
    realIconHtml = realIconHtml.replace("text-4xl", "text-5xl"); 
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    newDiceEl.classList.add('relative', 'z-10');
    
    // 등급 글로우 대신 -> 주사위 자체 색 글로우 (또는 등급색 유지)
    const glowColor = data.color && data.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 15px ${glowColor}80`; 

    // hiddenDice를 교체
    elBox.replaceChild(newDiceEl, elHidden);

    // NEW 뱃지
    if (isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-3 -right-3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "N";
        elBox.appendChild(badge);
    }

    // 4. 이름 등장 (밝기 변화)
    elName.classList.add('name-fade-in');
}

function checkAllRevealed(diceElements) {
    const allDone = diceElements.every(d => d.isRevealed);
    if (allDone) {
        const skipBtn = document.getElementById('summon-skip-btn');
        const continueMsg = document.getElementById('summon-continue-msg');
        const tapArea = document.getElementById('summon-tap-area');

        skipBtn.classList.add('hidden');
        continueMsg.classList.remove('hidden');
        
        // 전체 영역 터치 시 종료
        tapArea.classList.remove('hidden');
        tapArea.onclick = closeSummonOverlay;
    }
}

// 헬퍼: 등급 설정 가져오기
function getRarityConfig(rarity) {
    const map = {
        'Common': { color: '#94a3b8', icon: 'ri-focus-line', tailwind: 'text-slate-400' },
        'Rare':   { color: '#3b82f6', icon: 'ri-shield-line', tailwind: 'text-blue-500' },
        'Hero':   { color: '#a855f7', icon: 'ri-sword-line', tailwind: 'text-purple-500' },
        'Legend': { color: '#facc15', icon: 'ri-vip-crown-line', tailwind: 'text-yellow-400' }
    };
    return map[rarity] || map['Common'];
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