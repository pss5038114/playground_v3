// web/dice/js/ui_core.js

// [버전 관리] HTML 파일 내용이 바뀌면 이 숫자를 올려주세요
const APP_VERSION = "1.4"; 

async function loadComponents() {
    const tabs = [
        {id:'tab-shop',file:'lobby_shop.html'},
        {id:'tab-deck',file:'lobby_deck.html'},
        {id:'tab-battle',file:'lobby_start.html'},
        {id:'tab-event',file:'lobby_event.html'},
        {id:'tab-clan',file:'lobby_clan.html'}
    ];
    
    // 1. 모든 HTML 탭 로드 (캐시 방지 적용)
    await Promise.all(tabs.map(async(t)=>{
        try{
            // 파일명 뒤에 버전 쿼리스트링 추가
            const r = await fetch(`${t.file}?v=${APP_VERSION}`);
            if(r.ok) document.getElementById(t.id).innerHTML=await r.text();
        }catch(e){}
    }));
    
    // 2. 모듈 초기화
    if(typeof initGameCanvas === 'function') initGameCanvas();
    if(typeof fetchMyResources === 'function') fetchMyResources();
    if(typeof fetchMyDice === 'function') fetchMyDice();
    
    // 3. 덱 정보 로드 및 UI 초기화 (HTML 로드 후 실행 보장)
    if(typeof fetchMyDeck === 'function') {
        await fetchMyDeck(); // 데이터 가져오기
    }
    
    // 4. 데이터 로드 후 UI 강제 렌더링 (특히 덱 탭)
    if(typeof renderDeckUI === 'function') {
        renderDeckUI();
    }
}

const tabNames = ['shop','deck','battle','event','clan'];
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('text-blue-600',b.dataset.target===`tab-${name}`));
    
    if(name==='deck') {
        fetchMyDice();
        fetchMyDeck().then(() => {
            if(typeof renderDeckUI === 'function') renderDeckUI();
        });
    }
    
    // [NEW] 전투(홈) 탭 진입 시 홈 덱 UI 갱신
    if(name==='battle') {
        fetchMyDeck().then(() => {
            if(typeof renderHomeDeckUI === 'function') renderHomeDeckUI();
        });
    }
    
    if(name==='shop') fetchMyResources();
}

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