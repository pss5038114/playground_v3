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

// [소환 핸들러]
async function handleSummon(count) {
    const data = await summonDice(count);
    if (!data) return;

    if (count === 1) {
        const resultDice = data.results[0];
        // 신규 획득 여부는 서버에서 has_new 필드로 주면 좋지만, 여기선 로컬 판단
        // (주의: fetchMyDice로 최신 리스트가 동기화되어 있어야 정확함)
        const existing = currentDiceList.find(d => d.id === resultDice.id);
        const isNew = existing ? (existing.class_level === 0) : true;
        
        // 정보 매핑 (리스트에 없으면 resultDice 기본 정보 사용)
        const fullData = currentDiceList.find(d => d.id === resultDice.id) || resultDice;
        
        playSingleSummonAnimation(fullData, isNew);
    } else {
        const names = data.results.map(x=>`[${x.rarity}] ${x.name}`).join("\n");
        alert(`✨ 소환 결과 (10+1) ✨\n\n${names}`);
        fetchMyResources();
        fetchMyDice();
    }
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
    
    // 콤마 제거 후 정수 변환
    const currentGold = parseInt(document.getElementById('res-gold').innerText.replace(/,/g, '')) || 0;

    list.forEach(dice => {
        const isOwned = dice.class_level > 0;
        if(isOwned) ownedCount++;
        
        let isUpgradeable = false;
        
        // [수정] 서버에서 준 next_cost 정보 활용
        if (dice.next_cost) {
            const { cards, gold } = dice.next_cost;
            // 0레벨(해금)은 그리드에서 초록테두리 안 보여주는게 일반적이나, 원하시면 || dice.class_level === 0 추가
            if (dice.class_level > 0 && dice.quantity >= cards && currentGold >= gold) {
                isUpgradeable = true;
            }
        }

        // ... (이하 아이콘, 테두리 등 렌더링 로직 기존 유지) ...
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

// 상세 팝업
function showDiceDetail(diceId) {
    const dice = currentDiceList.find(d => d.id === diceId); if(!dice) return; currentSelectedDice = dice;
    
    // 기본 정보 바인딩
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
        // [MAX LEVEL]
        document.getElementById('popup-dice-cards').innerText = "MAX";
        progress.style.width = "100%";
        progress.className = "h-full w-full bg-slate-300";
        
        btn.innerHTML = `<span>MAX LEVEL</span>`;
        costInfo.innerText = "최고 레벨에 도달했습니다.";
        btnColorClass = "bg-slate-400 cursor-not-allowed";
        canUpgrade = false;
    } 
    else {
        // [해금 또는 강화]
        // dice.next_cost가 반드시 존재함 (백엔드에서 20미만이면 보내줌)
        const { cards: reqCards, gold: reqGold } = dice.next_cost;
        
        document.getElementById('popup-dice-cards').innerText = `${dice.quantity} / ${reqCards}`;
        const pct = Math.min((dice.quantity / reqCards) * 100, 100);
        progress.style.width = `${pct}%`;

        // 보유 조건 체크
        const hasEnoughCards = dice.quantity >= reqCards;
        const hasEnoughGold = currentGold >= reqGold;

        if (dice.class_level === 0) {
            // [해금]
            progColorClass = "bg-green-500";
            if (hasEnoughCards && hasEnoughGold) { // 해금도 이제 골드 비용 있음(1000)
                canUpgrade = true;
                btn.innerHTML = `<span>🔓 해금하기</span>`;
                costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드 (카드 1장)`;
                btnColorClass = "bg-green-500 hover:bg-green-600";
            } else {
                btn.innerHTML = !hasEnoughCards ? `<span>카드 부족</span>` : `<span>골드 부족</span>`;
                costInfo.innerText = !hasEnoughCards ? "카드를 더 모으세요" : `비용: ${reqGold.toLocaleString()} 골드`;
                btnColorClass = "bg-slate-300 cursor-not-allowed";
            }
        } else {
            // [강화]
            if (hasEnoughCards && hasEnoughGold) {
                canUpgrade = true;
                currentViewMode = 'class'; // 미리보기
                
                btn.innerHTML = `<span>⬆️ 레벨업</span>`;
                costInfo.innerText = `비용: ${reqGold.toLocaleString()} 골드`;
                
                btnColorClass = "bg-green-600 hover:bg-green-700"; // 초록 테마
                progColorClass = "bg-green-500";
            } else {
                currentViewMode = 'class'; // 불가능해도 미리보기는 보여줌
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
        // 아이콘 위 파티클
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

// [1회 소환 연출]
function playSingleSummonAnimation(diceData, isNew) {
    const overlay = document.getElementById('summon-overlay');
    const container = document.getElementById('summon-dice-container');
    const textArea = document.getElementById('summon-text-area');
    const tapArea = document.getElementById('summon-tap-area');
    
    // 초기화
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    textArea.classList.add('hidden');
    textArea.classList.remove('text-reveal'); // 애니메이션 재실행 위해 제거
    tapArea.classList.add('hidden');
    container.innerHTML = '';
    
    // 등급별 설정
    const rarityConfig = {
        'Common': { color: '#94a3b8', icon: 'ri-focus-line', tailwind: 'text-slate-400' },
        'Rare':   { color: '#3b82f6', icon: 'ri-shield-line', tailwind: 'text-blue-500' },
        'Hero':   { color: '#a855f7', icon: 'ri-sword-line', tailwind: 'text-purple-500' },
        'Legend': { color: '#facc15', icon: 'ri-vip-crown-line', tailwind: 'text-yellow-400' }
    };
    const config = rarityConfig[diceData.rarity] || rarityConfig['Common'];
    
    // 1. 하강 (미확인 상태)
    const hiddenDice = document.createElement('div');
    hiddenDice.className = `w-32 h-32 bg-slate-800 rounded-[22%] flex items-center justify-center shadow-2xl summon-drop cursor-pointer`;
    hiddenDice.style.boxShadow = `0 0 20px rgba(0,0,0,0.5)`;
    hiddenDice.innerHTML = `<i class="${config.icon} text-6xl text-white opacity-50"></i>`;
    container.appendChild(hiddenDice);

    // 2. 착지 후 대기 (0.6초 후)
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
        
        // 클릭 시 공개 이벤트
        hiddenDice.onclick = () => revealDice(hiddenDice, diceData, isNew, config);
        
    }, 600);
}

function revealDice(element, diceData, isNew, config) {
    element.onclick = null; // 중복 클릭 방지
    element.classList.remove('summon-waiting');
    
    // 3. 파동 및 공개
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    element.appendChild(ripple);
    
    // 실제 아이콘 렌더링 (크기 키워서)
    let realIconHtml = renderDiceIcon(diceData, "w-32 h-32");
    realIconHtml = realIconHtml.replace("text-4xl", "text-8xl");
    
    // 0.1초 후 교체 (파동 시작 시점)
    setTimeout(() => {
        const container = document.getElementById('summon-dice-container');
        container.innerHTML = realIconHtml; // 내용 교체
        
        // 교체된 요소 스타일링
        const newDiceFace = container.querySelector('.dice-face');
        if(newDiceFace) {
            newDiceFace.style.boxShadow = `0 0 30px ${config.color}80`;
            newDiceFace.classList.add('animate-bounce');
            setTimeout(() => newDiceFace.classList.remove('animate-bounce'), 500);
            
            if(isNew) {
                const badge = document.createElement('div');
                badge.className = 'absolute -top-4 -right-4 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white new-badge-pop z-20';
                badge.innerText = "NEW!";
                container.appendChild(badge);
            }
        }
        
        // 4. 텍스트 표시 (0.5초 후)
        setTimeout(() => {
            const textArea = document.getElementById('summon-text-area');
            const diceName = document.getElementById('summon-dice-name');
            const tapArea = document.getElementById('summon-tap-area');
            
            diceName.innerText = diceData.name;
            diceName.style.color = config.color;
            
            textArea.classList.remove('hidden');
            textArea.classList.add('text-reveal');
            
            tapArea.classList.remove('hidden'); // 전체 화면 터치 활성화
            tapArea.onclick = closeSummonOverlay;
            
        }, 500);
        
    }, 100);
}

function closeSummonOverlay() {
    const overlay = document.getElementById('summon-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
    
    fetchMyResources();
    fetchMyDice();
}