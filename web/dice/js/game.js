// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;

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

    // 로딩 시퀀스 시작
    await runLoadingSequence();
};

// 2. 이탈 방지 (뒤로가기/새로고침 경고)
function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

// 3. 로딩 시뮬레이션
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');
    
    try {
        updateLoading(10, "Connecting to server...");
        // TODO: 웹소켓 연결 로직
        await sleep(500);

        updateLoading(40, "Fetching map data...");
        // 서버 데이터 모의 (여기서 맵 데이터 생성)
        gameMap = getMockMapData(); 
        await sleep(500);

        updateLoading(70, "Loading resources...");
        // TODO: 이미지 프리로딩
        await sleep(800);

        updateLoading(100, "Ready to Battle!");
        await sleep(300);

        // 로딩 화면 제거 & UI 표시
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none'; // 완전히 가리기
        }, 500);

        // 인게임 UI 보이기
        if(uiTop) uiTop.classList.remove('hidden');
        if(uiBottom) {
            uiBottom.classList.remove('hidden');
            uiBottom.classList.add('flex');
        }

        console.log("Game Loop Starting...");
        // 게임 루프 시작
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("Loading Failed:", e);
        alert("게임 로딩에 실패했습니다. 로비로 돌아갑니다.");
        window.location.href = 'index.html'; // 로비로 강제 이동
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

// 4. 캔버스 설정 (반응형)
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');

    // 화면 꽉 채우기 (여백 없이)
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 게임 내부 해상도 (1080x1920) 비율 유지
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
    
    // 렌더링 컨텍스트 스케일링은 필요 없음 (내부 해상도 1080x1920 사용)
}

// 5. 게임 루프 (그리기)
function gameLoop() {
    if(!ctx) return;

    // 배경 클리어
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; // slate-800
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Helper Functions (자체 내장) ---

function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}

// [수정됨] 맵 데이터 생성 로직 (좌표계 변경: 좌하단 0,0 기준)
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
    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + (boardRows - uy) * unit // Y축 뒤집기 (Canvas는 상단이 0이므로)
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

    // 2. Grid (5x3)
    // Dice Grid 시작점: (1, 0) -> 즉 x는 1~6 범위, y는 0~3 범위
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
        
        // 둥근 사각형 그리기 (간단 구현)
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

// UI 함수들
window.toggleDebug = function() { alert("디버그 모드 준비중"); };
window.confirmSurrender = function() {
    if(confirm("정말 포기하시겠습니까?")) window.location.href = 'index.html';
};
window.spawnDice = function() { console.log("Spawn Request"); };
window.powerUp = function(idx) { console.log("Power Up:", idx); };