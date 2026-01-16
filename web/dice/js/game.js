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

// [수정됨] 백엔드 로직과 싱크를 맞춘 7x4 맵 데이터
function getMockMapData() {
    const width = 1080;
    const height = 1920;
    
    // Grid (7x4)
    const grid = [];
    const rows = 4, cols = 7;
    const cell_size = 125, gap = 15;
    
    const total_w = cols * cell_size + (cols - 1) * gap;
    const startX = (width - total_w) / 2;
    const startY = 1350;
    
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            grid.push({
                index: r*cols + c,
                x: startX + c*(cell_size+gap),
                y: startY + r*(cell_size+gap),
                w: cell_size, h: cell_size
            });
        }
    }
    
    // Path (심플한 U자 + 중앙 관통형)
    // 몬스터가 그리드 사이를 지나가게 하여 긴장감 조성
    const path = [
        {x: 100, y: -100},    // 시작
        {x: 100, y: 1200},    // 좌측 하단으로 내려옴
        {x: 980, y: 1200},    // 우측으로 횡단 (그리드 바로 위)
        {x: 980, y: 300},     // 우측 상단으로 올라감
        {x: 540, y: 300},     // 중앙으로 이동
        {x: 540, y: 2000}     // 중앙을 가로질러 아래로 골인 (End)
    ];
    
    return { width, height, path, grid };
}

function drawPath(ctx, path) {
    ctx.beginPath();
    ctx.lineWidth = 40;
    ctx.strokeStyle = "#334155"; 
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#475569"; 
    ctx.setLineDash([20, 20]);
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
}

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