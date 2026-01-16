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

async function fetchUserDeck() {
    // URL에서 username 파라미터가 없으면 로컬스토리지나 임시값 사용
    // 실제로는 세션 관리자가 필요하지만, 일단 API/deck/list 호출 시도
    // utils.js나 api.js가 없으므로 직접 구현
    
    // ★ 주의: 실제 구현 시에는 인증 토큰이나 쿠키를 사용해야 함.
    // 여기서는 테스트를 위해 'test_user' 또는 로비에서 넘겨준 정보를 쓴다고 가정.
    // 임시로 하드코딩된 데이터로 테스트 (API 연동 준비 완료)
    
    /* const res = await fetch(`/api/dice/list/${userId}`);
    const data = await res.json();
    return data;
    */
   
    // [Mock Data] 실제 DB 구조에 맞춘 더미 데이터
    return [
        { id: 'fire', name: 'Fire', rarity: 'Common', color: 'bg-red-500', symbol: 'ri-fire-fill', class_level: 3 },
        { id: 'electric', name: 'Electric', rarity: 'Common', color: 'bg-orange-300', symbol: 'ri-flashlight-fill', class_level: 3 },
        { id: 'wind', name: 'Wind', rarity: 'Common', color: 'bg-teal-300', symbol: 'ri-windy-fill', class_level: 2 },
        { id: 'ice', name: 'Ice', rarity: 'Common', color: 'bg-blue-300', symbol: 'ri-snowflake-fill', class_level: 2 },
        { id: 'poison', name: 'Poison', rarity: 'Common', color: 'bg-green-500', symbol: 'ri-skull-2-fill', class_level: 1 }
    ];
}

// [NEW] 하단 덱 렌더링 (utils.js의 renderDiceIcon 활용)
function renderBottomDeck(deck) {
    const slots = document.querySelectorAll('.dice-slot');
    const powerBtns = document.querySelectorAll('.power-btn');
    
    deck.forEach((dice, idx) => {
        if(idx >= slots.length) return;
        
        // 1. 주사위 아이콘 그리기
        const slot = slots[idx];
        slot.innerHTML = renderDiceIcon(dice, "w-10 h-10"); // utils.js 함수 사용
        
        // 2. 파워업 버튼 초기화
        const btn = powerBtns[idx];
        if(btn) {
            btn.innerHTML = `
                <span class="text-[9px] text-slate-400 font-bold block">Lv.1</span>
                <span class="text-[8px] text-yellow-500">100</span>
            `;
            btn.onclick = () => powerUp(idx, dice.id);
        }
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
// 캔버스 그리기 함수 수정 (배경 밝게)
function gameLoop() {
    if(!ctx) return;

    // 배경 (slate-800)
    ctx.fillStyle = "#1e293b"; 
    ctx.fillRect(0, 0, 1080, 1920);
    
    // 그리드 패턴 추가 (모눈종이 효과)
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 2;
    const gridSize = 140;
    
    /*
    ctx.beginPath();
    for(let x=0; x<=1080; x+=gridSize) { ctx.moveTo(x,0); ctx.lineTo(x,1920); }
    for(let y=0; y<=1920; y+=gridSize) { ctx.moveTo(0,y); ctx.lineTo(1080,y); }
    ctx.stroke();
    */

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

// 맵 데이터 (서버 로직과 동기화된 상하반전 수정본)
function getMockMapData() {
    const width = 1080;
    const height = 1920;
    const unit = 140; 
    
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (5 * unit)) / 2;

    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + uy * unit
    });

    // 1. Path: (0.5, -1) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, -1)
    // Canvas y좌표는 아래가 양수이므로, 
    // -1(상단) -> 3.5(하단) -> 3.5(하단) -> -1(상단) 순서가 맞음.
    const logicPath = [
        {x: 0.5, y: -1.0},
        {x: 0.5, y: 3.5},
        {x: 6.5, y: 3.5},
        {x: 6.5, y: -1.0}
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

    // 2. Grid (5x3)
    const grid = [];
    const rows = 3, cols = 5;
    const cellSize = unit * 0.9; 

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