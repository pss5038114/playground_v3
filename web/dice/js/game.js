// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let gameState = null;
let currentMode = 'solo';
let animationFrameId;

// 주사위 색상 매핑 (임시)
const DICE_COLORS = {
    'fire': '#ef4444',     // red-500
    'electric': '#fdba74', // orange-300
    'wind': '#5eead4',     // teal-300
    'ice': '#93c5fd',      // blue-300
    'poison': '#22c55e',   // green-500
    'default': '#cbd5e1'
};

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    console.log("Game Script Loaded.");
    
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';
    const sessionId = urlParams.get('session') || "test_session";

    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 로딩 시퀀스 대신 바로 접속 시도
    connectWebSocket(sessionId);
};

// 2. 웹소켓 연결
function connectWebSocket(sessionId) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/dice/${sessionId}`;
    
    updateLoading(20, "Connecting to Server...");
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        updateLoading(50, "Connected!");
        console.log("WS Connected");
        // 필요한 경우 JOIN 메시지 전송
        // socket.send(JSON.stringify({ type: "JOIN", mode: currentMode }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    socket.onclose = () => {
        alert("서버 연결이 끊어졌습니다.");
        location.href = 'index.html';
    };
}

// 3. 서버 메시지 처리
function handleServerMessage(data) {
    if (data.type === 'INIT') {
        gameMap = data.map;
        gameState = data.state;
        updateLoading(100, "Ready!");
        setTimeout(hideLoadingScreen, 500);
        updateUI(gameState);
        requestAnimationFrame(gameLoop);
    }
    else if (data.type === 'GAME_STATE') {
        gameState = data.state;
        // 맵 그리드 정보 갱신 (주사위 배치 등)
        if(gameMap && gameState.grid) {
            gameMap.grid = gameState.grid;
        }
        updateUI(gameState);
    }
}

function updateUI(state) {
    if(!state) return;
    // SP 및 소환 비용 업데이트
    const spEl = document.getElementById('game-sp');
    const costEl = document.getElementById('spawn-cost');
    const lifeEl = document.getElementById('game-lives');
    
    if(spEl) spEl.innerText = state.sp;
    if(costEl) costEl.innerText = state.spawn_cost;
    
    // 버튼 활성화/비활성화 시각적 처리
    const spawnBtn = document.querySelector('button[onclick="window.spawnDice()"]');
    if(spawnBtn) {
        if(state.sp < state.spawn_cost) {
            spawnBtn.classList.add('opacity-50', 'cursor-not-allowed');
            spawnBtn.classList.remove('active:scale-95');
        } else {
            spawnBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            spawnBtn.classList.add('active:scale-95');
        }
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');
    
    if(loadingScreen) loadingScreen.style.display = 'none';
    if(uiTop) uiTop.classList.remove('hidden');
    if(uiBottom) {
        uiBottom.classList.remove('hidden');
        uiBottom.classList.add('flex');
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

// 4. 캔버스 설정
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    
    const w = window.innerWidth;
    const h = window.innerHeight;
    const targetAspect = 1080 / 1920;
    const currentAspect = w / h;

    let finalW, finalH;
    if (currentAspect > targetAspect) {
        finalH = h; finalW = h * targetAspect;
    } else {
        finalW = w; finalH = w / targetAspect;
    }
    
    canvas.width = 1080;
    canvas.height = 1920;
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 5. 게임 루프
function gameLoop() {
    if(!ctx) return;

    // 배경
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; 
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- 그리기 함수들 ---

function drawPath(ctx, path) {
    if(!path || path.length < 2) return;

    // 길 그리기
    ctx.beginPath();
    ctx.lineWidth = 100;
    ctx.strokeStyle = "#334155"; // slate-700
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();

    // 점선 (중앙)
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#475569";
    ctx.setLineDash([20, 30]);
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawGrid(ctx, grid) {
    if(!grid) return;
    
    grid.forEach((cell) => {
        // 슬롯 배경
        const r = 16;
        const x=cell.x, y=cell.y, w=cell.w, h=cell.h;
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 4;
        
        drawRoundedRect(ctx, x, y, w, h, r);
        ctx.fill();
        ctx.stroke();

        // 주사위 그리기
        if(cell.dice) {
            drawDice(ctx, x, y, w, h, cell.dice);
        }
    });
}

function drawDice(ctx, x, y, w, h, dice) {
    const pad = 10;
    const size = w - pad*2;
    const dx = x + pad;
    const dy = y + pad;
    
    // 주사위 배경
    const color = DICE_COLORS[dice.id] || DICE_COLORS['default'];
    ctx.fillStyle = color;
    // 간단한 입체감
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 10;
    drawRoundedRect(ctx, dx, dy, size, size, 20);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 주사위 눈금 (Level = Dot Count)
    ctx.fillStyle = "white";
    drawDiceDots(ctx, dx + size/2, dy + size/2, size, dice.level);
    
    // 텍스트 (옵션)
    // ctx.fillStyle = "white";
    // ctx.font = "bold 20px Pretendard";
    // ctx.textAlign = "center";
    // ctx.fillText(dice.id, dx + size/2, dy + size + 20);
}

function drawDiceDots(ctx, cx, cy, size, value) {
    const dotSize = size * 0.16;
    const offset = size * 0.25;
    
    const positions = {
        1: [[0,0]],
        2: [[-1,-1], [1,1]],
        3: [[-1,-1], [0,0], [1,1]],
        4: [[-1,-1], [1,-1], [-1,1], [1,1]],
        5: [[-1,-1], [1,-1], [0,0], [-1,1], [1,1]],
        6: [[-1,-1], [1,-1], [-1,0], [1,0], [-1,1], [1,1]],
        7: [[0,0]] // 7 이상은 숫자로 표시하는게 나을수도
    };

    const pos = positions[value] || positions[1];
    
    pos.forEach(p => {
        ctx.beginPath();
        ctx.arc(cx + p[0]*offset, cy + p[1]*offset, dotSize/2, 0, Math.PI*2);
        ctx.fill();
    });
}

// --- 유틸리티 ---
function drawRoundedRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (e) => {
        e.preventDefault(); e.returnValue = ''; return '';
    });
}

// --- UI 액션 ---
window.spawnDice = function() {
    if(socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "SPAWN" }));
    }
};

window.toggleDebug = function() { alert("Debug Mode"); };
window.confirmSurrender = function() {
    if(confirm("정말 포기하시겠습니까?")) location.href = '../home.html';
};
window.powerUp = function(idx) { console.log("Power Up:", idx); };