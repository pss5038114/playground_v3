// web/dice/js/game.js

let canvas, ctx;
let gameMap = null;
let socket = null;
let currentMonsters = []; // 서버에서 받은 몬스터 목록

// 1. 초기화
window.onload = function() {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 맵 데이터 초기화 (좌표 변환용)
    gameMap = getMockMapData(); 
    
    // 게임 연결 시작
    connectGame();
};

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

    // 내부 해상도 1080x1920 고정
    canvas.width = 1080;  
    canvas.height = 1920; 
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 2. 서버 연결
function connectGame() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room') || 'TEST_ROOM';
    
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/game/${roomCode}`;

    console.log(`Connecting to ${wsUrl}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("🔥 Connected to Game Server!");
        document.getElementById('game-loading').style.display = 'none';
        document.getElementById('ui-top').classList.remove('hidden');
        document.getElementById('ui-bottom').classList.remove('hidden');
        document.getElementById('ui-bottom').classList.add('flex');
        
        // 게임 루프 시작
        requestAnimationFrame(gameLoop);
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'TICK') {
            // [핵심] 서버가 보낸 몬스터 위치 업데이트
            currentMonsters = data.monsters || [];
            if(data.wave) document.getElementById('game-wave').innerText = data.wave;
        }
    };
    
    socket.onerror = (e) => console.error("WS Error:", e);
}

// 3. 게임 루프 (그리기)
function gameLoop() {
    if(!ctx) return;

    // 1. 배경 지우기
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; // 배경색
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        // 2. 맵 그리기
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
        
        // 3. 몬스터 그리기 (서버 데이터 기반)
        drawMonsters(ctx, currentMonsters);
    }

    requestAnimationFrame(gameLoop);
}

// 4. 그리기 헬퍼 함수들
function drawMonsters(ctx, monsters) {
    if (!monsters) return;
    
    monsters.forEach(mon => {
        // 서버 좌표(x,y) -> 캔버스 좌표(px, py) 변환
        // gameMap.toPixel 함수를 사용
        const pos = gameMap.toPixel(mon.x, mon.y);
        
        const radius = 40; // 몬스터 크기

        // 그림자
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + 5, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        // 본체 (빨간색)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444"; 
        ctx.fill();
        
        // 테두리
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    });
}

function getMockMapData() {
    const width = 1080;
    const height = 1920;
    const unit = 140; 
    const boardRows = 4; 
    
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (boardRows * unit)) / 2;

    // 좌표 변환 함수 (Server Coord -> Canvas Pixel)
    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + (boardRows - uy) * unit 
    });

    // 배경용 경로 (서버 경로와 일치)
    const logicPath = [
        {x: 0.5, y: 0.0},
        {x: 0.5, y: 3.5},
        {x: 6.5, y: 3.5},
        {x: 6.5, y: 0.0}
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

    // 그리드 데이터 생성
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
                x: pos.x - cellSize/2,
                y: pos.y - cellSize/2,
                w: cellSize, h: cellSize
            });
        }
    }

    return { path, grid, toPixel };
}

function drawPath(ctx, path) {
    if(path.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 100;
    ctx.strokeStyle = "#334155";
    ctx.lineCap = "butt"; 
    ctx.lineJoin = "round"; 
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    
    // 중앙선
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
    grid.forEach(cell => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        const r = 16; 
        const x=cell.x, y=cell.y, w=cell.w, h=cell.h;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        ctx.fill();
        ctx.stroke();
    });
}

// 기능 버튼 (임시)
window.confirmSurrender = function() {
    if(confirm("정말 포기하시겠습니까?")) window.location.href = 'index.html';
};
window.spawnDice = function() { 
    if(socket) socket.send(JSON.stringify({type: "SPAWN_REQ"}));
};