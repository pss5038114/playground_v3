const GameApp = {
    currentSessionId: null,
    
    init: async () => {
        if (!checkAuth()) return;
        const user = getCurrentUser();
        document.getElementById('user-nickname').innerText = user.nickname;

        document.getElementById('btn-start-pvp').addEventListener('click', () => GameApp.startGame('pvp'));
        document.getElementById('btn-start-coop').addEventListener('click', () => GameApp.startGame('coop'));

        window.addEventListener('beforeunload', (e) => {
            if (GameApp.currentSessionId) {
                GameApp.sendExitSignal();
            }
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

    startGame: async (mode) => {
        const token = localStorage.getItem('access_token');
        try {
            const response = await fetch('/api/game/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ mode: mode })
            });

            if (response.ok) {
                const data = await response.json();
                GameApp.currentSessionId = data.session_id;
                document.getElementById('game-canvas-container').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Start Game Error:', error);
        }
    },

    stopGameUI: () => {
        if(confirm("게임을 포기하시겠습니까?")) {
            GameApp.sendExitSignal();
            document.getElementById('game-canvas-container').classList.add('hidden');
        }
    },

    spawnDice: async () => {
        if (!GameApp.currentSessionId) return;
        const token = localStorage.getItem('access_token');
        await fetch('/api/game/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                session_id: GameApp.currentSessionId,
                action_type: 'spawn'
            })
        });
    },

    exitGame: () => {
        if (confirm("로비로 돌아가시겠습니까?")) {
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