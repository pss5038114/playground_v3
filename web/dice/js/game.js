// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;
let userDeck = []; // 덱 데이터 저장용

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

        // [추가됨] 덱 데이터 불러오기
        updateLoading(50, "Loading User Deck...");
        await fetchUserDeck(); 
        renderBottomDeckSlots(); // 화면에 그리기
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

// [신규 함수] 유저 덱 가져오기 (API 호출)
async function fetchUserDeck() {
    try {
        // 실제 API 호출 (나중에 주석 해제하여 사용)
        // const res = await fetch('/api/dice/deck/active');
        // const data = await res.json();
        // userDeck = data.deck;

        // [테스트용] 모의 데이터 (API가 아직 없다면 이걸 사용)
        console.log("Fetching mock deck data...");
        userDeck = [
            { id: 'fire', name: 'Fire', color: '#ef4444' },     // Red
            { id: 'electric', name: 'Electric', color: '#eab308' }, // Yellow
            { id: 'wind', name: 'Wind', color: '#10b981' },     // Green
            { id: 'ice', name: 'Ice', color: '#3b82f6' },       // Blue
            { id: 'poison', name: 'Poison', color: '#a855f7' }  // Purple
        ];
    } catch (err) {
        console.error("Failed to fetch deck:", err);
        userDeck = []; // 에러 시 빈 덱
    }
}

// [신규 함수] 하단 덱 슬롯 렌더링 (주사위 눈 없이 색상/아이콘만)
function renderBottomDeckSlots() {
    const slots = document.querySelectorAll('.dice-slot');
    
    userDeck.forEach((dice, index) => {
        if (index >= slots.length) return;
        
        const slot = slots[index];
        // 기존 내용(Lv.1 텍스트 등) 초기화하지 않고, 배경/아이콘만 추가
        
        // 1. 슬롯 배경색 변경 (주사위 색상, 약간 투명하게)
        slot.style.backgroundColor = dice.color;
        slot.style.borderColor = adjustColor(dice.color, -20); // 테두리는 좀 더 진하게
        slot.style.boxShadow = `inset 0 0 10px rgba(0,0,0,0.2)`;

        // 2. 주사위 아이콘/심볼 추가 (눈금 대신)
        // 기존에 있던 span(Lv.1)은 유지하고, 그 뒤에 배경 이미지를 넣거나 아이콘을 추가
        
        // 아이콘 매핑 (RemixIcon 사용)
        let iconClass = 'ri-question-mark';
        switch(dice.id) {
            case 'fire': iconClass = 'ri-fire-fill'; break;
            case 'electric': iconClass = 'ri-flashlight-fill'; break;
            case 'wind': iconClass = 'ri-windy-fill'; break;
            case 'ice': iconClass = 'ri-snowflake-fill'; break;
            case 'poison': iconClass = 'ri-skull-2-fill'; break;
        }

        // 아이콘 엘리먼트 생성
        const iconEl = document.createElement('i');
        iconEl.className = `${iconClass} text-white text-2xl drop-shadow-md absolute`;
        iconEl.style.opacity = '0.9';
        
        // 기존 내용(Lv.1)을 맨 앞으로 가져오기 위해 z-index 조정이 필요할 수 있음
        // 일단 슬롯에 아이콘 추가
        slot.appendChild(iconEl);
        
        // Lv.1 텍스트가 가려지지 않게 처리 (기존 span 찾아서 z-index 올림)
        const levelSpan = slot.querySelector('span');
        if(levelSpan) {
            levelSpan.style.position = 'relative';
            levelSpan.style.zIndex = '10';
            levelSpan.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
            levelSpan.className = levelSpan.className.replace('text-slate-400', 'text-white'); // 글자색 흰색으로 변경
        }
    });
}

// 색상 밝기 조절 헬퍼 함수
function adjustColor(color, amount) {
    return color; // (실제 구현 시 HEX -> RGB 변환 후 계산 필요, 지금은 placeholder)
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