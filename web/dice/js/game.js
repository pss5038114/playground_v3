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
        await sleep(300);

        updateLoading(30, "Fetching User Deck...");
        
        // [핵심] 여기서 UI 초기화를 기다립니다. (에러나도 게임은 시작되게 try-catch 내부 처리)
        await initPowerUpUI(); 

        updateLoading(60, "Fetching Map Data...");
        gameMap = getMockMapData(); 
        await sleep(300);

        updateLoading(100, "Ready to Battle!");
        await sleep(200);

        // 로딩 화면 제거
        if(loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
        }

        if(uiTop) uiTop.classList.remove('hidden');
        if(uiBottom) {
            uiBottom.classList.remove('hidden');
            uiBottom.classList.add('flex'); // flex display 강제
        }

        console.log("Game Loop Starting...");
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("Loading Failed:", e);
        alert("로딩 중 오류가 발생했습니다.");
    }
}

// [수정됨] 파워업 UI 초기화 (데이터 직접 호출)
async function initPowerUpUI() {
    // localStorage에 저장된 ID 사용 (없으면 에러)
    const username = localStorage.getItem('username');
    if (!username) {
        console.error("No username found in localStorage");
        return;
    }

    try {
        // 1. 주사위 목록(상세 정보) 가져오기
        const listRes = await fetch(`/api/dice/list/${username}`);
        const diceList = await listRes.json();

        // 2. 장착 덱 정보 가져오기
        const deckRes = await fetch(`/api/dice/deck/${username}`);
        const deckData = await deckRes.json();
        
        // 현재 프리셋(1번)의 슬롯 배열 ["fire", "wind", ...]
        const currentDeckSlots = deckData.decks["1"].slots;

        // 3. UI 슬롯 채우기
        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        
        currentDeckSlots.forEach((diceId, idx) => {
            if (!uiSlots[idx]) return;

            // 상세 정보 찾기
            const diceInfo = diceList.find(d => d.id === diceId);
            
            if (diceInfo) {
                // [핵심] pips=0 으로 설정하여 눈이 없는 파워업 전용 아이콘 생성
                // w-full h-full로 부모 컨테이너 꽉 채우기
                const iconHtml = renderDiceIcon(diceInfo, "w-full h-full", 0);
                
                // 기존 내용 비우고 새로 삽입
                uiSlots[idx].innerHTML = iconHtml;

                // 중앙에 LV 텍스트 덮어쓰기 (기존 span이 있다면 제거하거나 덮어씀)
                // utils.js의 renderDiceIcon이 반환한 HTML 위에 얹음
                const lvBadge = document.createElement('span');
                lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-xs pointer-events-none z-20";
                lvBadge.innerText = `Lv.${diceInfo.class_level}`;
                
                uiSlots[idx].appendChild(lvBadge);
            }
        });
        console.log("PowerUp UI Initialized with Deck:", currentDeckSlots);

    } catch (err) {
        console.error("Failed to init PowerUp UI:", err);
        // 에러 나도 게임은 멈추지 않게 함
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
    const container = document.getElementById('game-container'); // 변경점: 컨테이너 기준
    
    if(!canvas || !container) return;
    ctx = canvas.getContext('2d');

    // 컨테이너의 현재 크기 가져오기
    const w = container.clientWidth;
    const h = container.clientHeight;

    // 게임 내부 해상도 (9:16 비율)
    const targetRatio = 1080 / 1920;
    const containerRatio = w / h;

    let finalW, finalH;

    // 비율에 맞춰 꽉 차게 계산 (Letterboxing)
    if (containerRatio > targetRatio) {
        // 컨테이너가 더 납작함 -> 높이에 맞춤
        finalH = h;
        finalW = h * targetRatio;
    } else {
        // 컨테이너가 더 길쭉함 -> 너비에 맞춤
        finalW = w;
        finalH = w / targetRatio;
    }

    // 캔버스 내부 해상도는 고정 (선명도 유지)
    canvas.width = 1080;  
    canvas.height = 1920; 
    
    // 화면 표시 크기 (CSS)
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 5. 게임 루프 (그리기) - 색상 변경됨
function gameLoop() {
    if(!ctx) return;

    // 배경 클리어 & 다시 그리기
    ctx.clearRect(0, 0, 1080, 1920);
    
    // [수정됨] 배경색: 약간 밝은 회색 (Gray-100 / Slate-50)
    ctx.fillStyle = "#f3f4f6"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    // (여기에 나중에 몬스터, 주사위 그리기 추가됨)

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Helper Functions (자체 내장) ---

function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}

function getMockMapData() {
    const width = 1080;
    const height = 1920;
    const unit = 140; // 1 단위 크기
    
    // 중앙 정렬 오프셋
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (5 * unit)) / 2;

    const toPixel = (ux, uy) => ({
        x: offsetX + ux * unit,
        y: offsetY + uy * unit
    });

    // [수정] Path (역 U자 형태 '∩' - 화면 하단 시작/종료)
    const logicPath = [
        {x: 0.5, y: 4.0},  // Start (왼쪽 하단)
        {x: 0.5, y: -0.5}, // Corner 1 (왼쪽 상단)
        {x: 6.5, y: -0.5}, // Corner 2 (오른쪽 상단)
        {x: 6.5, y: 4.0}   // End (오른쪽 하단)
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

    // 1. 도로 (Road)
    ctx.beginPath();
    ctx.lineWidth = 100; // 길 너비
    // [수정됨] 도로 색상: 회색 (Gray-300) - 배경보다 조금 더 어둡게
    ctx.strokeStyle = "#d1d5db"; 
    ctx.lineCap = "butt"; // 튀어나옴 방지 유지
    ctx.lineJoin = "round"; 

    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    
    // 2. 중앙선 (Center Line)
    ctx.beginPath();
    ctx.lineWidth = 4;
    // [수정됨] 선 색상: 파란색 (Blue-500)
    ctx.strokeStyle = "#3b82f6";
    // [수정됨] 실선으로 변경 (점선 해제)
    ctx.setLineDash([]); 
    
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
}

function drawGrid(ctx, grid) {
    ctx.lineWidth = 2; // 선 두께 약간 줄임
    grid.forEach((cell, idx) => {
        // [수정됨] 슬롯 배경: 밝은 흰색
        ctx.fillStyle = "#ffffff";
        // [수정됨] 슬롯 테두리: 연한 회색
        ctx.strokeStyle = "#e5e7eb";
        
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
        
        // 그림자 효과 살짝 (선택사항)
        ctx.shadowColor = "rgba(0,0,0,0.05)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        ctx.fill();
        
        // 그림자 끄고 테두리 그리기
        ctx.shadowColor = "transparent";
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