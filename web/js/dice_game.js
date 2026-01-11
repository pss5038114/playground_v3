/**
 * Dice Defense Core UI Logic (Playground V3)
 */
const GameApp = {
    currentSessionId: null,
    inventoryData: {},
    diceBook: {},

    // 등급별 UI 설정 (색상 요구사항 반영)
    rarityUI: {
        "Common": { border: "#ef4444", label: "일반" }, // 불, 바람
        "Rare": { border: "#facc15", label: "희귀" },   // 빛
        "Epic": { border: "#a855f7", label: "영웅" },   // 적응
        "Legendary": { border: "#00a86b", label: "전설" } // 태풍 (Jade)
    },

    // 초기화 함수
    init: async () => {
        console.log("GameApp Initializing...");
        
        // auth.js 함수 존재 확인 (ReferenceError 방지)
        if (typeof checkAuth === 'function') {
            if (!checkAuth()) return;
        } else {
            console.error("Critical: checkAuth is not defined. Ensure auth.js is loaded.");
        }
        
        if (typeof getCurrentUser === 'function') {
            const user = getCurrentUser();
            if (user) document.getElementById('user-nickname').innerText = user.nickname;
        }

        // 초기 인벤토리 및 티켓 정보 로드
        await GameApp.loadInventory();

        // 페이지 이탈 감지
        window.addEventListener('beforeunload', (e) => {
            if (GameApp.currentSessionId) GameApp.sendExitSignal();
        });
    },

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

    loadInventory: async () => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch('/api/game/inventory', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            GameApp.inventoryData = data.inventory;
            GameApp.diceBook = data.dice_book;
            
            // 티켓 카운트 갱신
            document.getElementById('shop-ticket-count').innerText = data.tickets || 0;
            
            // 인벤토리 렌더링
            GameApp.renderDiceGrid();
        } catch (e) {
            console.error("Inventory Fetch Error:", e);
        }
    },

    // 인벤토리 렌더링 (보유/미보유 섹션 구분)
    renderDiceGrid: () => {
        const ownedGrid = document.getElementById('owned-dice-grid');
        const unownedGrid = document.getElementById('unowned-dice-grid');
        ownedGrid.innerHTML = '';
        unownedGrid.innerHTML = '';
        
        let ownedCount = 0;
        const bookKeys = Object.keys(GameApp.diceBook);
        const reqCards = 5; // 업그레이드 필요 카드수 (고정)

        bookKeys.forEach(id => {
            const info = GameApp.diceBook[id];
            const inv = GameApp.inventoryData[id] || { cards: 0, level: 0 };
            const isOwned = inv.level > 0;
            if (isOwned) ownedCount++;

            const progress = Math.min((inv.cards / reqCards) * 100, 100);
            
            const card = document.createElement('div');
            card.className = `game-card p-4 flex flex-col items-center cursor-pointer transition-all hover:scale-105`;
            
            // 전설 등급 은은한 흰색 광채
            if (isOwned && info.rarity === 'Legendary') card.classList.add('rarity-legendary');

            // 주사위 아이콘 (흰색 배경 고정)
            let diceIconStyle = `border: 4px solid ${GameApp.rarityUI[info.rarity].border};`;
            let diceInner = `<span style="color: ${info.color}; font-size: 2.2rem;">🎲</span>`;
            
            // 적응 주사위 무지개 텍스트 특수 처리
            if (id === 'adapt') {
                diceInner = `<span class="rainbow-text" style="font-size: 2.2rem;">🎲</span>`;
            }

            card.innerHTML = `
                <div class="w-16 h-16 rounded-xl mb-3 flex items-center justify-center dice-bg border-4 shadow-sm" style="${diceIconStyle}">
                    ${diceInner}
                </div>
                <div class="text-[10px] font-black mb-1 text-center truncate w-full">${info.name.toUpperCase()}</div>
                <div class="text-[10px] text-yellow-500 mb-2 font-black italic">CL.${inv.level}</div>
                
                ${(!isOwned && inv.cards > 0) ? 
                    `<button onclick="event.stopPropagation(); GameApp.acquireDice('${id}')" 
                             class="w-full bg-green-600 hover:bg-green-500 text-[9px] py-1.5 rounded font-black animate-pulse">습득하기</button>` :
                    `<div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-auto border border-slate-800">
                        <div class="bg-green-500 h-full transition-all duration-500" style="width: ${progress}%"></div>
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

    // 가챠 뽑기
    openBox: async (count) => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch(`/api/game/gacha?count=${count}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                // 결과 이름 매핑
                const names = data.results.map(id => GameApp.diceBook[id].name);
                alert(`[획득 결과]\n${names.join('\n')}`);
                await GameApp.loadInventory();
            } else {
                const err = await res.json();
                alert(err.detail || "티켓이 부족합니다.");
            }
        } catch (e) { alert("통신 실패"); }
    },

    // 티켓 추가 디버그 버튼
    addTestTickets: async () => {
        const token = localStorage.getItem('access_token');
        try {
            const res = await fetch('/api/game/add-test-tickets', { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) {
                await GameApp.loadInventory(); // 즉시 갱신
            }
        } catch (e) { console.error(e); }
    },

    // 모달 제어
    openUpgradeModal: (id, info, inv) => {
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

    acquireDice: async (id) => {
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ dice_id: id })
        });
        await GameApp.loadInventory();
    },

    // 게임 세션 관련 (기존 코드 유지)
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

    stopGameUI: () => {
        if(confirm("항복하시겠습니까?")) {
            GameApp.sendExitSignal();
            document.getElementById('game-canvas-container').classList.add('hidden');
        }
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

// 스크립트 로드 완료 시 초기화 실행
window.addEventListener('DOMContentLoaded', GameApp.init);