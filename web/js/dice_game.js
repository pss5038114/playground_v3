/**
 * Dice Defense Core UI Logic
 */
const GameApp = {
    currentSessionId: null,
    inventoryData: {},
    diceBook: {},

    rarityUI: {
        "Common": { border: "#ef4444", label: "일반" },
        "Rare": { border: "#facc15", label: "희귀" },
        "Epic": { border: "#a855f7", label: "영웅" },
        "Legendary": { border: "#00a86b", label: "전설" } // 비취색(Jade) 적용
    },

    init: async () => {
        console.log("GameApp Initializing...");
        
        // window 객체에서 인증 함수 확인
        if (typeof window.checkAuth === 'function') {
            if (!window.checkAuth()) return;
        }

        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (user && user.nickname) {
            document.getElementById('user-nickname').innerText = user.nickname;
        }

        await GameApp.loadInventory();

        // 버튼 리스너 (HTML에 onclick이 없는 경우 대비)
        const pvpBtn = document.getElementById('btn-start-pvp');
        if (pvpBtn) pvpBtn.onclick = () => GameApp.startGame('pvp');
        
        const coopBtn = document.getElementById('btn-start-coop');
        if (coopBtn) coopBtn.onclick = () => GameApp.startGame('coop');

        window.addEventListener('beforeunload', () => {
            if (GameApp.currentSessionId) GameApp.sendExitSignal();
        });
    },

    switchTab: (tabName) => {
        document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${tabName}`);
        if (target) target.classList.remove('hidden');

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

    loadInventory: async () => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch('/api/game/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            GameApp.inventoryData = data.inventory || {};
            GameApp.diceBook = data.dice_book || {};
            
            document.getElementById('shop-ticket-count').innerText = data.tickets || 0;
            GameApp.renderDiceGrid();
        } catch (e) {
            console.error("Inven Load Error:", e);
        }
    },

    renderDiceGrid: () => {
        const ownedGrid = document.getElementById('owned-dice-grid');
        const unownedGrid = document.getElementById('unowned-dice-grid');
        if (!ownedGrid || !unownedGrid) return;

        ownedGrid.innerHTML = '';
        unownedGrid.innerHTML = '';
        
        let ownedCount = 0;
        const bookKeys = Object.keys(GameApp.diceBook);
        const reqCards = 5;

        bookKeys.forEach(id => {
            const info = GameApp.diceBook[id];
            const inv = GameApp.inventoryData[id] || { cards: 0, level: 0 };
            const isOwned = inv.level > 0;
            if (isOwned) ownedCount++;

            const progress = Math.min((inv.cards / reqCards) * 100, 100);
            
            const card = document.createElement('div');
            card.className = `game-card p-4 flex flex-col items-center cursor-pointer transition-all hover:scale-105`;
            if (isOwned && info.rarity === 'Legendary') card.classList.add('rarity-legendary');

            let diceInner = `<span style="color: ${info.color}; font-size: 2.2rem;">🎲</span>`;
            if (id === 'adapt') diceInner = `<span class="rainbow-text" style="font-size: 2.2rem;">🎲</span>`;

            card.innerHTML = `
                <div class="w-16 h-16 rounded-xl mb-3 flex items-center justify-center dice-bg border-4 shadow-sm" 
                     style="border-color: ${GameApp.rarityUI[info.rarity].border}">
                    ${diceInner}
                </div>
                <div class="text-[10px] font-black mb-1 text-center truncate w-full">${info.name.toUpperCase()}</div>
                <div class="text-[10px] text-yellow-500 mb-2 font-black italic">CL.${inv.level}</div>
                
                ${(!isOwned && inv.cards > 0) ? 
                    `<button onclick="event.stopPropagation(); GameApp.acquireDice('${id}')" 
                             class="w-full bg-green-600 text-[9px] py-1.5 rounded font-black animate-pulse">습득하기</button>` :
                    `<div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-auto border border-slate-800">
                        <div class="bg-green-500 h-full transition-all" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-[9px] mt-1 text-slate-500 font-mono">${inv.cards} / ${reqCards}</div>`
                }
            `;

            if (isOwned) {
                card.onclick = () => GameApp.openUpgradeModal(id, info, inv);
                ownedGrid.appendChild(card);
            } else {
                unownedGrid.appendChild(card);
            }
        });

        document.getElementById('inventory-count').innerText = `${ownedCount}/${bookKeys.length}`;
    },

    openBox: async (count) => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch(`/api/game/gacha?count=${count}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                alert(`[뽑기 결과]\n${data.results.map(id => GameApp.diceBook[id].name).join(', ')}`);
                await GameApp.loadInventory();
            } else {
                const err = await res.json();
                alert(err.detail || "티켓이 부족합니다.");
            }
        } catch (e) { alert("서버 통신 실패"); }
    },

    addTestTickets: async () => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch('/api/game/add-test-tickets', { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) await GameApp.loadInventory();
        } catch (e) { console.error(e); }
    },

    openUpgradeModal: (id, info, inv) => {
        const modal = document.getElementById('upgrade-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        
        document.getElementById('modal-dice-name').innerText = info.name;
        document.getElementById('modal-dice-rarity').innerText = GameApp.rarityUI[info.rarity].label;
        document.getElementById('modal-dice-rarity').style.color = GameApp.rarityUI[info.rarity].border;
        document.getElementById('modal-dice-class').innerText = `CLASS ${inv.level}`;
        
        const container = document.getElementById('modal-dice-container');
        container.style.borderColor = GameApp.rarityUI[info.rarity].border;
        container.innerHTML = (id === 'adapt') ? `<span class="rainbow-text">🎲</span>` : `<span style="color: ${info.color}">🎲</span>`;
        
        const upBtn = document.getElementById('modal-upgrade-btn');
        upBtn.disabled = (inv.cards < 5 || inv.level >= 20);
        upBtn.onclick = () => GameApp.upgradeDice(id);
    },

    closeModal: () => document.getElementById('upgrade-modal').classList.add('hidden'),

    upgradeDice: async (id) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/game/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dice_id: id })
        });
        if (res.ok) { GameApp.closeModal(); await GameApp.loadInventory(); }
    },

    acquireDice: async (id) => {
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dice_id: id })
        });
        await GameApp.loadInventory();
    },

    // 게임 시작 및 종료 로직 (기존 유지)
    startGame: async (mode) => {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/game/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mode: mode })
        });
        if (res.ok) {
            const data = await res.json();
            GameApp.currentSessionId = data.session_id;
            document.getElementById('game-canvas-container').classList.remove('hidden');
        }
    },

    sendExitSignal: () => {
        const token = localStorage.getItem('access_token');
        fetch('/api/game/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: GameApp.currentSessionId, action_type: 'leave' }),
            keepalive: true
        });
    },

    exitGame: () => {
        if (confirm("로비로 이동하시겠습니까?")) {
            if (GameApp.currentSessionId) GameApp.sendExitSignal();
            window.location.href = 'home.html';
        }
    }
};

// 전역 할당 (HTML onclick에서 접근 가능하도록)
window.GameApp = GameApp;
window.addEventListener('DOMContentLoaded', GameApp.init);