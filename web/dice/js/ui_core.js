// web/dice/js/ui_core.js

// 컴포넌트 로드 및 초기화
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
    
    // 각 모듈 초기화
    if(typeof initGameCanvas === 'function') initGameCanvas();
    if(typeof fetchMyResources === 'function') fetchMyResources();
    if(typeof fetchMyDice === 'function') fetchMyDice();
}

// 탭 전환 로직
const tabNames = ['shop','deck','battle','event','clan'];
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('text-blue-600',b.dataset.target===`tab-${name}`));
    
    if(name==='deck') fetchMyDice();
    if(name==='shop') fetchMyResources();
}

// [공통 헬퍼] 소환 오버레이 닫기 (소환 종료 후 호출됨)
function closeSummonOverlay() {
    const overlay = document.getElementById('summon-overlay');
    overlay.classList.remove('flex');
    overlay.classList.add('hidden');
    
    // 11회 소환용 닫기 영역 초기화
    const tapArea = document.getElementById('summon-tap-area');
    if(tapArea) {
        tapArea.classList.add('hidden');
        tapArea.style.zIndex = "0"; 
        tapArea.onclick = null;
    }

    // 1회 소환용 컨테이너 초기화
    const container = document.getElementById('summon-dice-container');
    if(container) container.classList.remove('dice-slide-up');
    
    fetchMyResources();
    fetchMyDice();
}

// [공통 헬퍼] 등급별 설정값 반환
function getRarityConfig(rarity) {
    const map = {
        'Common': { color: '#94a3b8', icon: 'ri-focus-line', tailwind: 'text-slate-400' },
        'Rare':   { color: '#3b82f6', icon: 'ri-shield-line', tailwind: 'text-blue-500' },
        'Hero':   { color: '#a855f7', icon: 'ri-sword-line', tailwind: 'text-purple-500' },
        'Legend': { color: '#facc15', icon: 'ri-vip-crown-line', tailwind: 'text-yellow-400' }
    };
    return map[rarity] || map['Common'];
}

// [공통 헬퍼] 신규 획득 여부 체크
function checkIsNew(diceId) {
    if (!currentDiceList || currentDiceList.length === 0) return true;
    const existing = currentDiceList.find(d => d.id === diceId);
    return !existing || existing.class_level === 0;
}