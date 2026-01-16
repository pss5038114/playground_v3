// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let scaleRatio = 1;
let currentMode = 'solo';

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    // URL 파라미터 확인 (mode)
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';
    console.log(`Initializing game in [${currentMode}] mode...`);

    // 이탈 방지 이벤트 등록
    setupLeaveWarning();

    // 캔버스 크기 설정
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 로딩 시작
    await runLoadingSequence();
};

// 2. 이탈 방지 (뒤로가기/새로고침 경고)
function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        // 표준 방식
        event.preventDefault();
        event.returnValue = ''; // Chrome에서는 이 설정이 필요함
        return '';
    });
}

// 3. 로딩 시뮬레이션
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    const uiLayer = document.getElementById('ui-layer');
    
    try {
        updateLoading(10, "Connecting to server...");
        // TODO: 웹소켓 연결 (dice_socket.py)
        await sleep(500);

        updateLoading(40, "Fetching map data...");
        // [임시] 서버에서 맵 데이터 수신 (game.py의 get_map_data)
        gameMap = getMockMapData(); 
        await sleep(500);

        updateLoading(70, "Loading resources...");
        // TODO: 이미지 프리로딩
        await sleep(800);

        updateLoading(100, "Ready to Battle!");
        await sleep(300);

        // 로딩 화면 제거 & UI 표시
        loadingScreen.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => loadingScreen.remove(), 500); // DOM에서 완전 제거
        uiLayer.classList.remove('hidden');

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

    canvas.width = 1080;  // 내부 좌표계 고정
    canvas.height = 1920; 
    
    // CSS로 화면에 맞게 늘리기/줄이기
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 5. 게임 루프 (그리기)
function gameLoop() {
    if(!ctx) return;

    // 배경 클리어
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1e293b"; // slate-800
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기 (이전에 만든 로직 활용)
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }

    requestAnimationFrame(gameLoop);
}

// [임시] 유틸리티
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// [수정됨] 백엔드 SoloGameSession 로직과 100% 일치
function getMockMapData() {
    const width = 1080;
    const height = 1920;
    const unit = 140; // 1 단위 크기
    
    // 중앙 정렬 오프셋
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (5 * unit)) / 2;

    // Helper: 논리 좌표 -> 픽셀 좌표
    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + uy * unit
    });

    // 1. Path (U자 형태)
    // (0.5, -1) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, -1)
    const logicPath = [
        {x: 0.5, y: -1.0},
        {x: 0.5, y: 3.5},
        {x: 6.5, y: 3.5},
        {x: 6.5, y: -1.0}
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

    // 2. Grid (5x3)
    // 주사위 중심: x=1.5~5.5, y=0.5~2.5
    const grid = [];
    const rows = 3, cols = 5;
    const cellSize = unit * 0.9; // 조금 작게

    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const lx = 1.5 + c;
            const ly = 0.5 + r;
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

// [수정] drawPath: 시작점과 끝점 처리
function drawPath(ctx, path) {
    if(path.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 100; // 길 너비 (Unit Size 140보다 작게)
    ctx.strokeStyle = "#334155"; // slate-700
    ctx.lineCap = "butt"; // 끝부분 평평하게
    ctx.lineJoin = "round"; // 코너 둥글게

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
    
    // 시작/끝 지점 표시 (디버그용)
    // ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
    // ctx.beginPath(); ctx.arc(path[0].x, path[0].y, 20, 0, Math.PI*2); ctx.fill();
    
    // ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    // ctx.beginPath(); ctx.arc(path[path.length-1].x, path[path.length-1].y, 20, 0, Math.PI*2); ctx.fill();
}

// [NEW] 로딩 완료 시 UI 표시
async function runLoadingSequence() {
    // ... (기존 로직) ...
    
    // 로딩 끝난 후 UI 보이기
    document.getElementById('ui-top').classList.remove('hidden');
    document.getElementById('ui-bottom').classList.remove('hidden');
    document.getElementById('ui-bottom').classList.add('flex'); // flex display 복구
    
    requestAnimationFrame(gameLoop);
}
// [NEW] 항복/디버그 함수
window.toggleDebug = function() {
    alert("디버그 모드 전환 (구현 예정)");
};
window.confirmSurrender = function() {
    if(confirm("정말 항복하시겠습니까?")) {
        window.location.href = 'index.html';
    }
};
window.powerUp = function(index) {
    console.log("Power Up Slot:", index);
};

function drawGrid(ctx, grid) {
    ctx.lineWidth = 3;
    
    grid.forEach((cell, idx) => {
        // 슬롯 배경 (약간의 그라데이션 효과)
        // const gradient = ctx.createLinearGradient(cell.x, cell.y, cell.x, cell.y + cell.h);
        // gradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
        // gradient.addColorStop(1, "rgba(255, 255, 255, 0.02)");
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        
        // 둥근 사각형 (Rounded Rect)
        const r = 16; // radius
        ctx.beginPath();
        ctx.roundRect(cell.x, cell.y, cell.w, cell.h, r);
        ctx.fill();
        ctx.stroke();
        
        // 슬롯 번호 (디버깅용, 아주 흐리게)
        // ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        // ctx.font = "20px Arial";
        // ctx.fillText(idx, cell.x + 10, cell.y + 30);
    });
}

// [임시] 소환 버튼 테스트
window.spawnDice = function() {
    console.log("Dice Spawn Requested!");
    // 나중에 여기에 서버로 소환 요청 보내는 로직 추가
    // socket.emit('spawn', ...);
};