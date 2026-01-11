/**
 * Dice Defense Core UI Logic
 */
const GameApp = {
    currentSessionId: null,
    inventoryData: {},
    diceBook: {},

    // 등급별 UI 설정
    rarityUI: {
        "Common": { border: "#ef4444", label: "일반" },
        "Rare": { border: "#facc15", label: "희귀" },
        "Epic": { border: "#a855f7", label: "영웅" },
        "Legendary": { border: "#2dd4bf", label: "전설" }
    },

    init: async () => {
        if (!checkAuth()) return;
        const user = getCurrentUser();
        document.getElementById('user-nickname').innerText = user.nickname;

        // 이벤트 리스너
        document.getElementById('btn-start-pvp').addEventListener('click', () => GameApp.startGame('pvp'));
        document.getElementById('btn-start-coop').addEventListener('click', () => GameApp.startGame('coop'));

        // 초기 인벤토리 로드
        await GameApp.loadInventory();

        // 이탈 감지
        window.addEventListener('beforeunload', (e) => {
            if (GameApp.currentSessionId) GameApp.sendExitSignal();
        });
    },

    // 탭 전환
    switchTab: (tabName) => {
        document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${tabName}`).classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            if(btn.dataset.target === `view-${tabName}`) {
                btn.classList.add('tab-active');
                btn.classList.remove('text-slate-500');
            } else {
                btn.classList.remove('tab-active');
                btn.classList.add('text-slate-500');
            }
        });
    },

    // 데이터 로드
    loadInventory: async () => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch('/api/game/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            GameApp.inventoryData = data.inventory;
            GameApp.diceBook = data.dice_book;
            
            document.getElementById('shop-ticket-count').innerText = data.tickets;
            GameApp.renderDiceGrid();
        } catch (e) {
            console.error("Inven Load Error:", e);
        }
    },

    // 인벤토리 그리드 렌더링 (5열)
    renderDiceGrid: () => {
        const grid = document.getElementById('dice-grid');
        grid.innerHTML = '';
        
        let ownedCount = 0;
        const bookKeys = Object.keys(GameApp.diceBook);

        bookKeys.forEach(id => {
            const info = GameApp.diceBook[id];
            const inv = GameApp.inventoryData[id] || { cards: 0, level: 0 };
            const isOwned = inv.level > 0;
            if (isOwned) ownedCount++;

            const reqCards = 5; // 테스트용 고정값
            const progress = Math.min((inv.cards / reqCards) * 100, 100);
            
            const card = document.createElement('div');
            card.className = `game-card p-4 flex flex-col items-center cursor-pointer transition-all ${!isOwned ? 'opacity-40 grayscale' : 'hover:scale-105 hover:bg-slate-800'}`;
            
            // 전설 등급 특수 효과
            if (isOwned && info.rarity === 'Legendary') card.classList.add('rarity-legendary');

            // 주사위 외형 (배경 흰색, 테두리 대표색)
            let diceInner = `<span style="color: ${info.color}; font-size: 2.5rem;">🎲</span>`;
            if (id === 'adapt') diceInner = `<span class="rainbow-text" style="font-size: 2.5rem;">🎲</span>`;

            card.innerHTML = `
                <div class="w-20 h-20 rounded-2xl mb-3 flex items-center justify-center dice-bg border-4" 
                     style="border-color: ${GameApp.rarityUI[info.rarity].border}">
                    ${diceInner}
                </div>
                <div class="text-[11px] font-black mb-1 truncate w-full text-center">${info.name.toUpperCase()}</div>
                <div class="text-[10px] text-yellow-500 mb-2 font-black italic">CL.${inv.level}</div>
                
                ${(!isOwned && inv.cards > 0) ? 
                    `<button onclick="event.stopPropagation(); GameApp.acquireDice('${id}')" 
                             class="w-full bg-green-600 hover:bg-green-500 text-[10px] py-1.5 rounded-lg font-black animate-pulse shadow-lg shadow-green-900/40">습득하기</button>` :
                    `<div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-auto border border-slate-800">
                        <div class="bg-green-500 h-full transition-all duration-500" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-[9px] mt-1 text-slate-500 font-mono">${inv.cards} / ${reqCards}</div>`
                }
            `;

            // 보유 중일 때만 팝업 허용
            if (isOwned) {
                card.onclick = () => GameApp.openUpgradeModal(id, info, inv);
            }
            grid.appendChild(card);
        });

        document.getElementById('inventory-count').innerText = `${ownedCount}/${bookKeys.length}`;
    },

    // 가챠 실행
    openBox: async (count) => {
        const token = localStorage.getItem('access_token');
        if (!confirm(`${count === 10 ? '11' : '1'}개의 주사위 카드를 뽑으시겠습니까?`)) return;

        try {
            const res = await fetch(`/api/game/gacha?count=${count}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                // 심플 결과창 (추후 화려한 연출 추가 가능)
                alert(`[뽑기 결과]\n${data.results.map(id => GameApp.diceBook[id].name).join(', ')} 를 획득했습니다!`);
                await GameApp.loadInventory();
            } else {
                const err = await res.json();
                alert(err.detail);
            }
        } catch (e) { alert("통신 오류가 발생했습니다."); }
    },

    // 업그레이드 모달
    openUpgradeModal: (id, info, inv) => {
        GameApp.selectedDiceId = id;
        const modal = document.getElementById('upgrade-modal');
        modal.classList.remove('hidden');
        
        document.getElementById('modal-dice-name').innerText = info.name;
        document.getElementById('modal-dice-rarity').innerText = GameApp.rarityUI[info.rarity].label;
        document.getElementById('modal-dice-rarity').style.color = GameApp.rarityUI[info.rarity].border;
        document.getElementById('modal-dice-class').innerText = `CLASS ${inv.level}`;
        
        const container = document.getElementById('modal-dice-container');
        container.style.borderColor = GameApp.rarityUI[info.rarity].border;
        container.innerHTML = (id === 'adapt') ? `<span class="rainbow-text">🎲</span>` : `<span style="color: ${info.color}">🎲</span>`;
        
        const upBtn = document.getElementById('modal-upgrade-btn');
        const canUpgrade = inv.cards >= 5 && inv.level < 20;
        upBtn.disabled = !canUpgrade;
        upBtn.innerText = inv.level >= 20 ? "MAX CLASS" : `CLASS UP (5)`;
        upBtn.onclick = () => GameApp.upgradeDice(id);
    },

    closeModal: () => document.getElementById('upgrade-modal').classList.add('hidden'),

    // 클래스 업그레이드 요청
    upgradeDice: async (id) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/game/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dice_id: id })
        });
        if (res.ok) {
            GameApp.closeModal();
            await GameApp.loadInventory();
        }
    },

    // 미습득 주사위 활성화 (CL.0 -> CL.1)
    acquireDice: async (id) => {
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dice_id: id })
        });
        await GameApp.loadInventory();
    },

    // 티켓 추가 테스트
    addTestTickets: async () => {
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/add-test-tickets', { 
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        await GameApp.loadInventory();
    },

    // --- 기본 게임 세션 관리 ---
    startGame: async (mode) => {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mode: mode })
        });
        if (response.ok) {
            const data = await response.json();
            GameApp.currentSessionId = data.session_id;
            document.getElementById('game-canvas-container').classList.remove('hidden');
        }
    },

    stopGameUI: () => {
        if(confirm("항복하시겠습니까? 세션이 종료됩니다.")) {
            GameApp.sendExitSignal();
            document.getElementById('game-canvas-container').classList.add('hidden');
        }
    },

    spawnDice: async () => {
        if (!GameApp.currentSessionId) return;
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: GameApp.currentSessionId, action_type: 'spawn' })
        });
    },

    exitGame: () => {
        if (confirm("로비로 이동하시겠습니까?")) {
            if (GameApp.currentSessionId) GameApp.sendExitSignal();
            window.location.href = 'home.html';
        }
    },

    sendExitSignal: () => {
        const token = localStorage.getItem('access_token');
        if (!token || !GameApp.currentSessionId) return;
        fetch('/api/game/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: GameApp.currentSessionId, action_type: 'leave' }),
            keepalive: true
        });
        GameApp.currentSessionId = null;
    }
};

window.addEventListener('DOMContentLoaded', GameApp.init);