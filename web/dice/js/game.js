// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;
let ws = null; // 웹소켓 객체

// 게임 상태 (서버 동기화용)
let gameState = {
    wave: 1,
    phase: 'NORMAL',
    timer: 30, // 초기값
    lives: 3,
    mobs: []
};

window.onload = async function() {
    console.log("Game Script Loaded.");
    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 게임 로딩 및 시작
    await runLoadingSequence();
};

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
    });
}

// =========================================
// [핵심] 로딩 시퀀스 & 서버 연결
// =========================================
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    
    try {
        updateLoading(10, "Creating Game Room...");
        
        // 1. 방 생성 요청 (API 호출)
        const roomCode = await createGameRoom();
        console.log("Room Created:", roomCode);

        updateLoading(30, "Connecting to Server...");
        
        // 2. 웹소켓 연결
        await connectToGameServer(roomCode);
        
        updateLoading(60, "Fetching Resources...");
        // 맵 데이터는 서버 로직(game.py)과 클라이언트(utils.js/game.js)가 
        // 동일한 좌표계를 쓰므로 여기서는 모의 데이터로 초기화
        gameMap = getMockMapData(); 
        await sleep(500);

        updateLoading(100, "Battle Start!");
        await sleep(500);

        // 로딩 화면 제거
        loadingScreen.style.opacity = '0';
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);

        // 게임 루프 시작
        console.log("Game Loop Starting...");
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("Critical Error:", e);
        alert(`게임 접속 실패: ${e.message}`);
        window.location.href = 'index.html';
    }
}

// API: 방 생성
async function createGameRoom() {
    const response = await fetch('/api/dice/create_room?mode=solo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error("Failed to create room");
    const data = await response.json();
    return data.room_code;
}

// WS: 서버 연결
function connectToGameServer(roomCode) {
    return new Promise((resolve, reject) => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/dice/ws/dice/${roomCode}`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log("WS Connected!");
            resolve();
        };

        ws.onerror = (err) => {
            console.error("WS Error:", err);
            reject(err);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleServerMessage(msg);
            } catch (e) {
                console.error("Packet Parse Error:", e);
            }
        };
        
        ws.onclose = () => {
            console.log("WS Disconnected");
            // alert("서버 연결이 끊어졌습니다.");
            // window.location.href = 'index.html';
        };
    });
}

// 서버 메시지 처리 핸들러
function handleServerMessage(msg) {
    if (msg.type === 'GAME_STATE') {
        // 서버가 보내준 최신 상태로 덮어쓰기
        gameState = msg.data;
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

// =========================================
// 캔버스 & 렌더링
// =========================================
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
        finalH = h;
        finalW = h * targetAspect;
    } else {
        finalW = w;
        finalH = w / targetAspect;
    }

    canvas.width = 1080;  
    canvas.height = 1920; 
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

function gameLoop() {
    if(!ctx) return;

    // 1. 배경
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. 맵
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    // 3. 몬스터 (서버 데이터 기반)
    if(gameState.mobs) {
        gameState.mobs.forEach(mob => drawMob(ctx, mob));
    }

    // 4. UI 오버레이 (Canvas에 직접 그림)
    drawUI(ctx);

    animationFrameId = requestAnimationFrame(gameLoop);
}

function drawMob(ctx, mob) {
    ctx.beginPath();
    
    // 몹 종류별 스타일
    let color = "#ef4444"; // Normal
    let radius = 20;
    
    if(mob.type === 'speed') {
        color = "#eab308"; // Yellow
        radius = 18;
    } else if(mob.type === 'large') {
        color = "#a855f7"; // Purple
        radius = 35;
    } else if(mob.type === 'boss_knight') {
        color = "#ffffff"; // White Boss
        radius = 60;
    }
    
    ctx.fillStyle = color;
    ctx.arc(mob.x, mob.y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // HP Bar
    const hpPercent = Math.max(0, mob.hp / mob.max_hp);
    const barWidth = radius * 2;
    
    ctx.fillStyle = "#333";
    ctx.fillRect(mob.x - radius, mob.y - radius - 15, barWidth, 6);
    ctx.fillStyle = "#22c55e"; 
    ctx.fillRect(mob.x - radius, mob.y - radius - 15, barWidth * hpPercent, 6);
}

function drawUI(ctx) {
    ctx.save();
    
    // 상단 정보 바 배경
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, 1080, 160);
    
    // 1. Wave 정보 (중앙)
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px sans-serif";
    
    const phaseText = gameState.phase === 'BOSS' ? "BOSS WAVE" : `WAVE ${gameState.wave}`;
    ctx.fillText(phaseText, 540, 70);
    
    // 2. Timer (Normal 페이즈일 때만)
    if(gameState.phase === 'NORMAL') {
        ctx.font = "40px sans-serif";
        ctx.fillStyle = "#fbbf24"; // Amber
        ctx.fillText(`Next Wave: ${gameState.timer}s`, 540, 130);
    }
    
    // 3. Life (좌측 상단)
    ctx.textAlign = "left";
    ctx.font = "bold 40px sans-serif";
    ctx.fillStyle = "#f87171"; // Red
    ctx.fillText(`♥ ${gameState.lives}`, 40, 100);

    ctx.restore();
}

// --- Helper Functions ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 기존 getMockMapData 함수 등은 그대로 유지 (또는 utils.js에 있다면 생략 가능)
function getMockMapData() {
    // ... (이전 코드와 동일, 생략하거나 필요하면 다시 넣어드립니다) ...
    // 좌표계: 좌하단 0,0 기준 로직이 적용된 버전이어야 함
    const width = 1080;
    const height = 1920;
    const unit = 140; 
    const boardRows = 4; 
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (boardRows * unit)) / 2;
    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + (boardRows - uy) * unit 
    });
    const logicPath = [
        {x: 0.5, y: 0.0}, {x: 0.5, y: 3.5}, {x: 6.5, y: 3.5}, {x: 6.5, y: 0.0}
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));
    const grid = [];
    const rows = 3; cols = 5; cellSize = unit * 0.9; 
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const lx = 1.0 + c + 0.5; 
            const ly = 0.0 + r + 0.5;
            const pos = toPixel(lx, ly);
            grid.push({
                index: r*cols + c,
                x: pos.x - cellSize/2, y: pos.y - cellSize/2,
                w: cellSize, h: cellSize, cx: pos.x, cy: pos.y
            });
        }
    }
    return { width, height, path, grid };
}

// 캔버스 그리기 헬퍼
function drawPath(ctx, path) {
    if(path.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 100; ctx.strokeStyle = "#334155"; 
    ctx.lineCap = "butt"; ctx.lineJoin = "round"; 
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.lineWidth = 4; ctx.strokeStyle = "#475569";
    ctx.setLineDash([20, 30]);
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke(); ctx.setLineDash([]);
}

function drawGrid(ctx, grid) {
    ctx.lineWidth = 4;
    grid.forEach((cell) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        const r = 16; 
        const x=cell.x, y=cell.y, w=cell.w, h=cell.h;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    });
}