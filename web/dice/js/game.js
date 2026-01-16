// web/dice/js/game.js

let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let ws = null; // 웹소켓 객체

// [추가] 서버 상태 저장용 변수
let serverState = null; 

window.onload = async function() {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    
    // 로컬 맵 데이터 생성 (배경 그리기용)
    gameMap = getMockMapData(); 
    
    // 게임 시작 시퀀스 (방 생성 -> 연결)
    await startGameSequence();
    
    requestAnimationFrame(gameLoop);
};

async function startGameSequence() {
    try {
        // 1. 방 생성 요청
        const res = await fetch('/api/dice/create_room?mode=solo', { method: 'POST' });
        const data = await res.json();
        const roomCode = data.room_code;
        console.log("Room Created:", roomCode);

        // 2. 웹소켓 연결
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/dice/ws/dice/${roomCode}`);
        
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === "GAME_STATE") {
                serverState = msg.data; // 최신 상태 업데이트
                updateUI(serverState);  // UI 텍스트(웨이브 정보 등) 업데이트
            }
        };

        ws.onopen = () => console.log("Connected to Game Server");
        ws.onclose = () => alert("서버 연결이 종료되었습니다.");

    } catch (e) {
        console.error("Failed to start game:", e);
    }
}

function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    
    // 해상도 고정 및 스케일링 로직 (이전과 동일)
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

    // 1. 배경 클리어 & 그리기
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; 
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    // 2. 몹 그리기 (서버 상태 기반)
    if (serverState && serverState.mobs) {
        drawMobs(ctx, serverState.mobs);
    }

    requestAnimationFrame(gameLoop);
}

function drawMobs(ctx, mobs) {
    mobs.forEach(mob => {
        ctx.beginPath();
        
        // 몹 타입별 스타일
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
        const hpPercent = mob.hp / mob.max_hp;
        ctx.fillStyle = "red";
        ctx.fillRect(mob.x - 20, mob.y - mob.radius - 15, 40, 6);
        ctx.fillStyle = "#22c55e"; // Green
        ctx.fillRect(mob.x - 20, mob.y - mob.radius - 15, 40 * hpPercent, 6);
    });
}

function updateUI(state) {
    // 상단 UI 정보 갱신 (HTML 요소가 있다고 가정)
    const waveEl = document.getElementById('wave-info'); // 예: "WAVE 1"
    const timerEl = document.getElementById('timer-info'); // 예: "29.5s"
    
    if(waveEl) waveEl.innerText = `WAVE ${state.wave}`;
    if(timerEl) {
        if (state.phase === 'boss') timerEl.innerText = "BOSS FIGHT";
        else timerEl.innerText = `${state.timer}s`;
    }
}

// ... (getMockMapData, drawPath, drawGrid 등 기존 헬퍼 함수들은 유지) ...
function getMockMapData() {
    // [중요] 서버 Logic과 동일한 좌표계(좌하단 0,0)를 사용하는 Map Data 함수
    // (이전 턴에서 수정한 버전 그대로 사용하세요)
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
    
    // Grid 생성 (생략 - 이전 코드와 동일)
    // ...
    return { width, height, path, grid: [] }; // grid는 일단 빈 배열 혹은 기존 로직
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
}
function drawGrid(ctx, grid) { /* 생략 */ }