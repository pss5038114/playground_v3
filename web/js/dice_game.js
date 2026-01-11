// 현재 활성화된 탭 인덱스 (0: Shop, 1: Deck, 2: Play, 3: Event)
const tabs = ['shop', 'deck', 'play', 'event'];
let currentTabIndex = 2; // Play 탭이 기본값

document.addEventListener('DOMContentLoaded', () => {
    checkAuth(); // auth.js의 함수 (로그인 확인)
    renderUserInfo();
    updateUI();

    // 브라우저 뒤로가기/새로고침 방지
    window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = ''; // Chrome 등에서 경고창 표시
    });
});

async function renderUserInfo() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-display').textContent = `${user.nickname} (Lv.${user.level || 1})`;
    }
}

// --- 탭 네비게이션 로직 ---
function switchTab(tabName) {
    // 모든 뷰 숨기기
    document.querySelectorAll('.game-view').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => {
        el.classList.remove('text-blue-400', 'bg-slate-800', 'border-t-2', 'border-blue-500');
        el.classList.add('text-gray-400');
    });

    // 선택된 뷰 보이기
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    
    // 버튼 스타일 활성화
    const activeBtn = document.querySelector(`button[data-target="${tabName}"]`);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-blue-400', 'bg-slate-800', 'border-t-2', 'border-blue-500');
    }

    currentTabIndex = tabs.indexOf(tabName);
}

function navigateTab(direction) {
    let newIndex = currentTabIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= tabs.length) newIndex = tabs.length - 1;
    switchTab(tabs[newIndex]);
}

// --- 게임 로직 ---

async function startGame() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return alert("로그인이 필요합니다.");

    try {
        const response = await fetch('/api/game/dice/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.user_id })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Game Started:", data);
            
            // UI 전환: 대기 화면 숨기고 그리드 표시
            document.getElementById('game-canvas-placeholder').classList.add('hidden');
            document.getElementById('game-grid').classList.remove('hidden');
            
            initGrid(); // 그리드 생성 함수 호출
        } else {
            alert("게임을 시작할 수 없습니다.");
        }
    } catch (e) {
        console.error(e);
        alert("서버 오류가 발생했습니다.");
    }
}

function initGrid() {
    const gridEl = document.getElementById('game-grid');
    gridEl.innerHTML = '';
    // 3x5 그리드 생성 (총 15칸)
    for (let i = 0; i < 15; i++) {
        const slot = document.createElement('div');
        slot.className = "w-full h-full bg-slate-700/50 border border-slate-600 rounded flex items-center justify-center text-xs text-gray-500";
        slot.dataset.index = i;
        slot.innerText = i; // 디버깅용 좌표
        gridEl.appendChild(slot);
    }
}

// --- 종료 로직 ---
async function attemptExit() {
    if (confirm("게임을 종료하고 로비로 돌아가시겠습니까? 진행 상황이 저장되지 않을 수 있습니다.")) {
        // 서버에 종료 알림 (선택 사항)
        // await fetch('/api/game/dice/quit', ...);
        
        window.location.href = "/static/home.html";
    }
}