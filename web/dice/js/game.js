// web/dice/js/game.js

// --- 전역 변수 ---
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;

// 서버 통신 관련 변수
let ws = null;          // 웹소켓 객체
let serverState = null; // 서버에서 받은 최신 게임 상태 (mobs, wave, timer 등)

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    console.log("Game Script Loaded.");
    
    // URL 파라미터 확인 (mode)
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';
    console.log(`Initializing game in [${currentMode}] mode...`);

    // 이탈 방지 이벤트 등록
    setupLeaveWarning();

    // 캔버스 크기 설정
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 1. 로컬 맵 데이터 생성 (배경 렌더링용)
    // 서버와 동일한 좌표계(좌하단 0,0)를 사용합니다.
    gameMap = getMockMapData(); 

    // 2. 게임 시작 시퀀스 (방 생성 -> 소켓 연결)
    await startGameSequence();

    // 3. 렌더링 루프 시작
    requestAnimationFrame(gameLoop);
};

// 2. 게임 시작 및 서버 연결
async function startGameSequence() {
    const loadingScreen = document.getElementById('game-loading');
    
    try {
        updateLoading(10, "Creating Game Room...");
        
        // 1) 방 생성 요청
        const res = await fetch('/api/dice/create_room?mode=solo', { method: 'POST' });
        if (!res.ok) throw new Error("Failed to create room");
        const data = await res.json();
        const roomCode = data.room_code;
        console.log("Room Created:", roomCode);

        updateLoading(50, "Connecting to Server...");

        // 2) 웹소켓 연결
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 주의: 배포 환경에 따라 경로는 유동적일 수 있음 (/api/dice/ws/dice/...)
        ws = new WebSocket(`${protocol}//${window.location.host}/api/dice/ws/dice/${roomCode}`);
        
        ws.onopen = () => {
            console.log("Connected to Game Server");
            updateLoading(100, "Ready!");
            
            // 로딩 화면 제거
            setTimeout(() => {
                if(loadingScreen) loadingScreen.style.display = 'none';
            }, 500);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "GAME_STATE") {
                    serverState = msg.data; // 최신 상태 업데이트
                    updateUI(serverState);  // HTML UI 텍스트 갱신
                }
            } catch (e) {
                console.error("Packet Error:", e);
            }
        };

        ws.onclose = () => {
            alert("서버와의 연결이 종료되었습니다.");
            window.location.href = 'index.html';
        };

        ws.onerror = (err) => {
            console.error("WebSocket Error:", err);
        };

    } catch (e) {
        console.error("Start Sequence Failed:", e);
        alert("게임 시작에 실패했습니다.");
        window.location.href = 'index.html';
    }
}

// 3. 메인 게임 루프 (렌더링)
function gameLoop() {
    if(!ctx) return;

    // 화면 클리어
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; // slate-800
    ctx.fillRect(0, 0, 1080, 1920);

    // 1) 맵 그리기 (배경)
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    // 2) 몹 그리기 (서버 데이터 기반)
    if (serverState && serverState.mobs) {
        drawMobs(ctx, serverState.mobs);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// 4. 몹 렌더링 함수
function drawMobs(ctx, mobs) {
    mobs.forEach(mob => {
        ctx.beginPath();
        
        // 몹 타입별 색상 설정
        if (mob.type === 'normal') ctx.fillStyle = "#94a3b8";      // Gray
        else if (mob.type === 'speed') ctx.fillStyle = "#fbbf24";  // Yellow
        else if (mob.type === 'big') ctx.fillStyle = "#3b82f6";    // Blue
        else if (mob.type === 'knight') ctx.fillStyle = "#ef4444"; // Red (Boss)
        else ctx.fillStyle = "#ffffff";
        
        // 원 그리기
        ctx.arc(mob.x, mob.y, mob.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 테두리
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // HP 바 그리기 (몹 상단)
        const hpPercent = Math.max(0, mob.hp / mob.max_hp);
        const barWidth = 40;
        const barHeight = 6;
        const barX = mob.x - barWidth / 2;
        const barY = mob.y - mob.radius - 10;

        // HP 배경 (빨강)
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // HP 현재 값 (초록)
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
    });
}

// 5. UI 업데이트 (HTML 요소가 존재한다고 가정)
function updateUI(state) {
    const waveEl = document.getElementById('wave-info'); // 예: <div id="wave-info">...</div>
    const timerEl = document.getElementById('timer-info'); // 예: <div id="timer-info">...</div>
    
    if(waveEl) {
        waveEl.innerText = `WAVE ${state.wave}`;
    }
    
    if(timerEl) {
        if (state.phase === 'boss') {
            timerEl.innerText = "BOSS";
            timerEl.style.color = "#ef4444"; // Red text for boss
        } else if (state.phase === 'gathering') {
            timerEl.innerText = "NEXT...";
            timerEl.style.color = "#fbbf24";
        } else {
            // Normal phase
            timerEl.innerText = `${state.timer}s`;
            timerEl.style.color = "#ffffff";
        }
    }
}

// --- Helper Functions (맵 데이터 및 캔버스 설정) ---

function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');

    // 화면 꽉 채우기 (여백 없이 비율 유지)
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 게임 내부 해상도 (1080x1920) 비율
    const targetAspect = 1080 / 1920;
    const currentAspect = w / h;

    let finalW, finalH;

    if (currentAspect > targetAspect) {
        // 화면이 더 넓음 -> 높이에 맞춤
        finalH = h;
        finalW = h * targetAspect;
    } else {
        // 화면이 더 좁음 -> 너비에 맞춤
        finalW = w;
        finalH = w / targetAspect;
    }

    // 캔버스 내부 해상도 고정
    canvas.width = 1080;  
    canvas.height = 1920; 
    
    // CSS로 화면 표출 크기 조정
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 맵 데이터 생성 (수정된 좌표계: 좌하단 0,0 기준, 역 U자 경로)
function getMockMapData() {
    const width = 1080;
    const height = 1920;
    const unit = 140; // 1 단위 크기
    
    // 보드 전체 크기 (가로 7칸, 세로 4칸 기준 가정)
    const boardRows = 4; 
    
    // 중앙 정렬 오프셋 계산
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (boardRows * unit)) / 2;

    // 좌표 변환 함수 (Logical -> Pixel)
    // ux: 0 ~ 7 (Left -> Right)
    // uy: 0 ~ 4 (Bottom -> Top) ** Y축 반전 적용 **
    // Canvas는 좌상단이 (0,0)이므로 y좌표 계산 시 뒤집어야 함
    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + (boardRows - uy) * unit 
    });

    // 1. Path (역 U자 / n자 형태)
    // 시작(0.5, 0) -> 위(0.5, 3.5) -> 오른쪽(6.5, 3.5) -> 아래(6.5, 0)
    const logicPath = [
        {x: 0.5, y: 0.0},
        {x: 0.5, y: 3.5},
        {x: 6.5, y: 3.5},
        {x: 6.5, y: 0.0}
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

    // 2. Grid (5x3) - 주사위 배치 구역
    // Dice Grid 시작점: (1, 0) -> 즉 x는 1~6 범위, y는 0~3 범위 내에 배치
    const grid = [];
    const rows = 3; // 주사위 놓을 공간 세로 3칸
    const cols = 5; // 주사위 놓을 공간 가로 5칸
    const cellSize = unit * 0.9; 

    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            // 주사위 그리드 시작점 (1, 0) 기준
            // 각 칸의 중심 좌표 계산 (x: 1.5 ~ 5.5, y: 0.5 ~ 2.5)
            const lx = 1.0 + c + 0.5; 
            const ly = 0.0 + r + 0.5;
            
            const pos = toPixel(lx, ly);
            
            grid.push({
                index: r*cols + c,
                x: pos.x - cellSize/2,
                y: pos.y - cellSize/2,
                w: cellSize, h: cellSize,
                cx: pos.x, cy: pos.y
            });
        }
    }

    return { width, height, path, grid };
}

function drawPath(ctx, path) {
    if(path.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 100; // 길 너비
    ctx.strokeStyle = "#334155"; // slate-700
    ctx.lineCap = "butt"; 
    ctx.lineJoin = "round"; 

    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    
    // 점선 중앙선
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
    ctx.lineWidth = 4;
    grid.forEach((cell, idx) => {
        // 배경
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        
        // 둥근 사각형 그리기
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

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}