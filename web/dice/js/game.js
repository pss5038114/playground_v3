// 전역 게임 상태
const gameState = {
    grid: Array(15).fill(null), // 15칸 그리드
    sp: 100,
    spCost: 10,
    wave: 1,
    isPlaying: false
};

let socket = null;

// [1] 초기화 및 연결
async function initGame() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');

    if (!sessionId) {
        alert("세션 ID가 없습니다. 로비로 돌아갑니다.");
        window.location.href = 'home.html';
        return;
    }

    // WebSocket 연결
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/dice/ws/${sessionId}`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("서버 연결 성공!");
        // runLoadingSequence(); // 로딩 바 완료 처리 등
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    socket.onclose = () => {
        alert("서버와의 연결이 끊어졌습니다.");
    };

    // 소환 버튼 이벤트 연결 (DOM ID 확인 필요: ui_summon.js에서 렌더링하는 버튼)
    document.addEventListener('click', (e) => {
        // ui_summon.js에 있는 버튼의 id가 'btn-summon'이라고 가정
        // 혹은 utils.js 의 renderDiceIcon 등을 통해 생성된 버튼
        if (e.target.closest('#btn-summon')) { 
            spawnDice();
        }
    });
}

// [2] 서버 메시지 처리 핸들러
function handleServerMessage(data) {
    if (data.type === 'GRID_UPDATE') {
        // 서버에서 온 데이터로 상태 동기화
        gameState.grid = data.grid;
        gameState.sp = data.sp;
        gameState.spCost = data.sp_cost;
        
        // 화면 갱신
        renderBoard();
        updateUI();
    }
    else if (data.message) {
        // 알림 메시지 (ex: SP 부족)
        console.log("Server:", data.message);
    }
}

// [3] 액션: 주사위 소환 요청
function spawnDice() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    // 서버로 SPAWN 명령 전송
    socket.send(JSON.stringify({
        type: "SPAWN"
    }));
}

// [4] 렌더링: 그리드 그리기
function renderBoard() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 캔버스 초기화 (배경)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 맵 경로 그리기 (배경 이미지 혹은 선)
    // ... (map rendering logic) ...

    // 그리드 및 주사위 그리기
    // 서버 좌표: 200 + c * 150, 1000 + r * 150 (SoloGameLogic 참조)
    const startX = 200;
    const startY = 1000;
    const cellSize = 140; // 간격 150이므로 크기는 약간 작게
    
    gameState.grid.forEach((dice, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        
        const x = startX + col * 150;
        const y = startY + row * 150;

        // 빈 칸 슬롯 그리기 (테두리)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cellSize, cellSize);

        // 주사위가 있으면 그리기
        if (dice) {
            drawDice(ctx, x, y, cellSize, dice);
        }
    });
}

// [Helper] 주사위 그리기
function drawDice(ctx, x, y, size, diceData) {
    // 1. 배경 (등급/속성에 따른 색상)
    ctx.fillStyle = getDiceColor(diceData.id); // utils.js 등에서 가져오거나 임시 구현
    ctx.fillRect(x + 5, y + 5, size - 10, size - 10);
    
    // 2. 텍스트 (이름/ID) - 임시
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(diceData.id, x + 20, y + 40);

    // 3. 눈금 (Dot) - diceData.level 에 따라
    ctx.fillStyle = "white";
    ctx.fillText(`Lv.${diceData.level}`, x + 20, y + 80);
}

function getDiceColor(id) {
    // 임시 색상 매핑
    if (id === '1001') return '#ff4444'; // Fire
    if (id === '1002') return '#4444ff'; // Ice
    return '#888888';
}

function updateUI() {
    // SP 및 소환 비용 텍스트 갱신
    const spEl = document.getElementById('ui-sp');
    const costEl = document.getElementById('ui-summon-cost');
    
    if (spEl) spEl.innerText = gameState.sp;
    if (costEl) costEl.innerText = `${gameState.spCost} SP`;
}

// 게임 시작
window.onload = initGame;