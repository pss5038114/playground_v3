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

        updateLoading(40, "Fetching user deck...");
        // await를 써도 에러가 나지 않도록 함수 내부에 안전장치를 마련했습니다.
        await initPowerUpUI();

        updateLoading(40, "Fetching map data...");
        // 서버 데이터 모의 (여기서 맵 데이터 생성)
        gameMap = getMockMapData(); 
        await sleep(500);

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

// [신규] 하단 파워업 버튼에 주사위 그리기
async function initPowerUpUI() {
    // 1. myId가 있는지 확인 (state.js 또는 localStorage)
    const username = typeof myId !== 'undefined' ? myId : localStorage.getItem('username');
    if (!username) return;

    try {
        // 2. 서버에서 내 덱과 주사위 목록 가져오기 (api.js의 함수 활용)
        // fetchMyDice()가 완료되어 currentDiceList가 채워져야 함
        if (typeof fetchMyDice === 'function') await fetchMyDice();
        
        // 덱 정보 가져오기
        const res = await fetch(`${API_DICE}/deck/${username}`);
        if (!res.ok) return;
        
        const data = await res.json();
        // 현재 선택된 프리셋(1번) 덱 슬롯 (id 배열)
        const activeSlots = data.decks["1"].slots; 

        const slots = document.querySelectorAll('.dice-slot');
        
        activeSlots.forEach((diceId, idx) => {
            // currentDiceList에서 상세 정보 찾기
            const diceInfo = currentDiceList.find(d => d.id === diceId);
            if (diceInfo && slots[idx]) {
                // 주사위 눈이 없는 파워업 전용 아이콘 생성
                slots[idx].innerHTML = renderPowerUpDiceIcon(diceInfo, "w-14 h-14");
                
                // 슬롯 중앙에 LV 표시
                const lvSpan = document.createElement('span');
                lvSpan.className = "absolute inset-0 flex items-center justify-center text-slate-400 font-black text-xs pointer-events-none z-20";
                lvSpan.innerText = `Lv.${diceInfo.class_level || 1}`;
                slots[idx].appendChild(lvSpan);
            }
        });
    } catch (err) {
        console.error("PowerUp UI 초기화 중 오류:", err);
    }
}

// [신규] 파워업 전용 주사위 렌더러 (utils.js 참조, 주사위 눈 제거)
function renderPowerUpDiceIcon(dice, sizeClass) {
    let sizeIndex = 14; 
    const match = sizeClass.match(/w-(\d+)/);
    if (match) sizeIndex = parseInt(match[1], 10);
    
    const borderWidth = Math.max(2, sizeIndex * 0.2);
    const fontSize = sizeIndex * 4 * 0.85; 

    const { borderColor, effectClasses, customStyle } = getDiceVisualClasses(dice);
    
    let finalCustomStyle = `${customStyle} border-width: ${borderWidth}px; border-style: solid;`;
    const symbolIcon = dice.symbol || "ri-dice-fill";

    // 배경 아이콘 (주사위 눈 대신 심볼을 크게 배치)
    const bgSymbolHtml = `<div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 text-slate-400 z-0" style="font-size: ${fontSize}px;"><i class="${symbolIcon}"></i></div>`;
    
    // [중요] 기존 renderDiceIcon에서 주사위 눈(dice-content) 부분만 삭제함
    return `
        <div class="dice-face ${sizeClass} ${borderColor} ${effectClasses} relative flex items-center justify-center overflow-hidden" style="${finalCustomStyle}">
            ${bgSymbolHtml}
        </div>`;
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