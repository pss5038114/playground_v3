const GameApp = {
    currentSessionId: null,
    
    init: async () => {
        // 1. 로그인 체크 (auth.js의 함수 활용)
        if (!checkAuth()) return;
        
        // 2. 유저 정보 표시
        const user = getCurrentUser();
        document.getElementById('user-nickname').innerText = user.nickname;

        // 3. 이벤트 리스너 등록
        document.getElementById('btn-start-pvp').addEventListener('click', () => GameApp.startGame('pvp'));
        document.getElementById('btn-start-coop').addEventListener('click', () => GameApp.startGame('coop'));

        // 4. 페이지 이탈 감지 (게임 중이라면 종료 처리)
        window.addEventListener('beforeunload', (e) => {
            if (GameApp.currentSessionId) {
                GameApp.sendExitSignal();
                e.returnValue = '게임이 진행 중입니다. 정말 나가시겠습니까?';
            }
        });
    },

    // 탭 전환 로직
    switchTab: (tabName) => {
        // 모든 뷰 숨김
        document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
        // 선택된 뷰 표시
        const targetId = `view-${tabName}`;
        document.getElementById(targetId).classList.remove('hidden');

        // 네비게이션 버튼 스타일 업데이트
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if(btn.dataset.target === targetId) {
                btn.classList.add('text-yellow-400', 'bg-gray-700');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('text-yellow-400', 'bg-gray-700');
                btn.classList.add('text-gray-400');
            }
        });
    },

    // 게임 시작 (API 호출)
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
                console.log(`Game Started: ${data.session_id} (${mode})`);
                
                // 인게임 화면(Canvas) 표시
                document.getElementById('game-canvas-container').classList.remove('hidden');
                
                // TODO: 캔버스 렌더링 루프 시작
                // renderLoop();
            } else {
                alert('게임 시작 실패: ' + response.statusText);
            }
        } catch (error) {
            console.error('Start Game Error:', error);
        }
    },

    // 게임 액션: 주사위 소환
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
                action_type: 'spawn',
                payload: {}
            })
        });
    },

    // 게임 종료 및 나가기
    exitGame: async () => {
        if (confirm("정말 게임을 종료하고 로비로 돌아가시겠습니까?")) {
            if (GameApp.currentSessionId) {
                await GameApp.sendExitSignal();
            }
            window.location.href = 'home.html';
        }
    },

    // 이탈 신호 전송 (페이지 닫힘 등)
    sendExitSignal: () => {
        const token = localStorage.getItem('access_token');
        const data = JSON.stringify({ session_id: GameApp.currentSessionId, action_type: 'leave' });
        
        // sendBeacon은 페이지 언로드 시에도 안정적으로 요청을 보냄
        const blob = new Blob([data], {type: 'application/json'});
        // 헤더 설정이 제한적이므로, 식별은 토큰보다는 세션 ID에 의존해야 할 수도 있음.
        // 여기서는 fetch를 사용하되 keepalive 옵션을 켬
        fetch('/api/game/leave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: data,
            keepalive: true
        });
        
        GameApp.currentSessionId = null;
    }
};

// 앱 초기화
window.addEventListener('DOMContentLoaded', GameApp.init);