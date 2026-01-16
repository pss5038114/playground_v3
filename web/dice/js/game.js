// web/dice/js/game.js

let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let ws = null; 
let serverState = null; // 서버에서 받은 게임 상태

window.onload = async function() {
    console.log("Game Script Loaded.");
    
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    
    // 로컬 맵 데이터 생성 (배경 그리기용)
    gameMap = getMockMapData(); 
    
    // 이탈 방지
    setupLeaveWarning();

    // 게임 시작 시퀀스 (방 생성 -> 연결)
    await startGameSequence();
    
    // 렌더링 루프 시작
    requestAnimationFrame(gameLoop);
};

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

async function startGameSequence() {
    const loadingScreen = document.getElementById('game-loading');
    
    try {
        updateLoading(20, "Creating Room...");
        // 1. 방 생성 요청
        const res = await fetch('/api/dice/create_room?mode=solo', { method: 'POST' });
        const data = await res.json();
        const roomCode = data.room_code;
        console.log("Room Created:", roomCode);

        updateLoading(50, "Connecting to Server...");
        // 2. 웹소켓 연결
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/dice/ws/dice/${roomCode}`);
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "GAME_STATE") {
                serverState = msg.data; // 최신 상태 업데이트
                updateUI(serverState);
            }
        };

        ws.onopen = () => {
            updateLoading(100, "Connected!");
            setTimeout(() => {
                if(loadingScreen) loadingScreen.style.display = 'none';
            }, 500);
        };
        
        ws.onclose = () => {
            alert("서버 연결이 종료되었습니다.");
        };

    } catch (e) {
        console.error("Failed to start game:", e);
        alert("게임 시작 실패");
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

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

function gameLoop() {
    if(!ctx) return;

    // 1. 배경 클리어
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. 맵 그리기
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    // 3. 몹 그리기 (서버 상태 기반)
    if (serverState && serverState.mobs) {
        drawMobs(ctx, serverState.mobs);
    }

    requestAnimationFrame(gameLoop);
}

function drawMobs(ctx, mobs) {
    mobs.forEach(mob => {
        ctx.beginPath();
        
        // 몹 타입별 색상
        if (mob.type === 'normal') ctx.fillStyle = "#94a3b8"; // Gray
        else if (mob.type === 'speed') ctx.fillStyle = "#fbbf24"; // Yellow
        else if (mob.type === 'big') ctx.fillStyle = "#3b82f6"; // Blue
        else if (mob.type === 'knight') ctx.fillStyle = "#ef4444"; // Red (Boss)
        
        // 원 그리기
        ctx.arc(mob.x, mob.y, mob.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 테두리
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // HP 바 (간단 구현)
        const hpPercent = Math.max(0, mob.hp / mob.max_hp);
        ctx.fillStyle = "red";
        ctx.fillRect(mob.x - 20, mob.y - mob.radius - 15, 40, 6);
        ctx.fillStyle = "#22c55e"; // Green
        ctx.fillRect(mob.x - 20, mob.y - mob.radius - 15, 40 * hpPercent, 6);
    });
}

function updateUI(state) {
    // 상단 UI 정보 갱신
    const waveEl = document.getElementById('wave-info'); // HTML id="wave-info" 필요
    const timerEl = document.getElementById('timer-info'); // HTML id="timer-info" 필요
    
    if(waveEl) waveEl.innerText = `WAVE ${state.wave}`;
    if(timerEl) {
        if (state.phase === 'boss') timerEl.innerText = "BOSS";
        else if (state.phase === 'gathering') timerEl.innerText = "NEXT...";
        else timerEl.innerText = `${state.timer}s`;
    }
}

// --- Helper Functions ---

function getMockMapData() {
    // 서버 로직과 동일한 좌표계 (좌하단 0,0 기준)
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

    // 그리드 (5x3)
    const grid = [];
    const rows = 3; 
    const cols = 5; 
    const cellSize = unit * 0.9; 

    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const lx = 1.0 + c + 0.5; 
            const ly = 0.0 + r + 0.5;
            const pos = toPixel(lx, ly);
            
            grid.push({
                index: r*cols + c,
                x: pos.x - cellSize/2,
                y: pos.y - cellSize/2,
                w: cellSize, h: cellSize
            });
        }
    }

    return { width, height, path, grid };
}

function drawPath(ctx, path) {
    if(path.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 100;
    ctx.strokeStyle = "#334155"; 
    ctx.lineCap = "butt"; ctx.lineJoin = "round"; 
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    
    // 점선 중앙선
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#475569";
    ctx.setLineDash([20, 30]);
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
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
        ctx.fill();
        ctx.stroke();
    });
}

// UI Placeholder
window.toggleDebug = function() { alert("디버그 모드"); };
window.confirmSurrender = function() {
    if(confirm("포기하시겠습니까?")) window.location.href = 'index.html';
};
window.spawnDice = function() { console.log("Spawn Request"); };
window.powerUp = function(idx) { console.log("Power Up:", idx); };