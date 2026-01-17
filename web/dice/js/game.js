// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let gameState = null; // SP, Lives, Wave 등
let currentMode = 'solo';
let animationFrameId;
const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    console.log("Game Script Loaded.");
    
    // 비로그인 차단
    if (!myId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'index.html';
        return;
    }
    
    // URL 파라미터 확인 (mode, preset)
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';
    const presetIndex = urlParams.get('preset') || 1;
    
    console.log(`Initializing game in [${currentMode}] mode with Preset ${presetIndex}...`);

    // 이탈 방지 이벤트 등록
    setupLeaveWarning();

    // 캔버스 크기 설정
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 로딩 시퀀스 시작
    await runLoadingSequence(presetIndex);
};

// 2. 이탈 방지
function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

// 3. 게임 시작 및 로딩
async function runLoadingSequence(presetIndex) {
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');
    
    try {
        updateLoading(10, "Connecting to server...");
        await sleep(300);

        updateLoading(30, "Initializing Game Session...");
        
        // [API 호출] 게임 시작 (덱 정보 로드 및 세션 생성)
        const response = await fetch(`${API_DICE}/game/solo/start`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: myId,
                preset_index: presetIndex
            })
        });

        if (!response.ok) {
            throw new Error("Failed to start game session");
        }

        const data = await response.json();
        
        // 데이터 저장
        gameMap = data.map;
        gameState = data.state;
        const deckDetails = data.deck_details;

        updateLoading(70, "Setting up board...");
        
        // UI 초기화
        initGameUI(gameState, deckDetails);
        
        await sleep(500);
        updateLoading(100, "Ready to Battle!");
        await sleep(300);

        // 로딩 화면 제거 & UI 표시
        loadingScreen.style.opacity = '0';
        loadingScreen.style.pointerEvents = 'none';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none'; 
        }, 500);

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
        window.location.href = 'index.html'; 
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text'); // HTML에 없다면 무시됨
    if(bar) bar.style.width = `${percent}%`;
    // loading-text 요소가 있다면 텍스트 업데이트 가능
}

// [UI 초기화 함수]
function initGameUI(state, deckList) {
    // 1. 상단 정보 (Wave, Life)
    document.getElementById('game-wave').innerText = state.wave;
    document.getElementById('game-lives').innerText = state.lives;
    
    // 2. 하단 정보 (SP)
    document.getElementById('game-sp').innerText = state.sp;
    
    // 3. 덱 슬롯 렌더링 (하단 바)
    // .dice-slot 요소들을 찾아서 채워넣음
    const slots = document.querySelectorAll('.dice-slot');
    
    deckList.forEach((dice, idx) => {
        if (idx >= slots.length) return;
        const slot = slots[idx];
        
        // 기존 내용 비우기 (Lv 텍스트 제외하고 싶다면 구조 변경 필요, 여기선 덮어쓰거나 추가)
        // play.html 구조상 <span>Lv.1</span>이 있음. 이를 유지하면서 배경색/아이콘 변경.
        
        // 배경색 적용 (Tailwind 클래스 제거 후 style로 직접 적용 or 클래스 교체)
        // dice.color는 "bg-red-500" 같은 클래스임.
        slot.className = `aspect-square rounded-lg border border-slate-200 relative dice-slot flex items-center justify-center group shadow-inner ${dice.color}`;
        
        // 아이콘 추가
        // 기존 span(Lv.1)을 유지하기 위해 innerHTML을 조심스럽게 다룸
        const lvSpan = slot.querySelector('span');
        const lvText = lvSpan ? lvSpan.outerHTML : '<span class="text-white font-bold text-xs pointer-events-none z-10">Lv.1</span>';
        
        // Remix Icon 클래스
        const iconClass = dice.symbol || 'ri-dice-fill';
        
        slot.innerHTML = `
            <i class="${iconClass} text-4xl text-white opacity-90"></i>
            <div class="absolute bottom-1 right-1">${lvText}</div>
        `;
        
        // 파워업 버튼 연결 등은 추후 구현
    });
}

// 4. 캔버스 설정
function setupCanvas() {
    canvas = document.getElementById('game-canvas');
    const container = document.getElementById('game-container'); 
    
    if(!canvas || !container) return;
    ctx = canvas.getContext('2d');

    const w = container.clientWidth;
    const h = container.clientHeight;

    const targetRatio = 1080 / 1920;
    const containerRatio = w / h;

    let finalW, finalH;

    if (containerRatio > targetRatio) {
        finalH = h;
        finalW = h * targetRatio;
    } else {
        finalW = w;
        finalH = w / targetRatio;
    }

    canvas.width = 1080;  
    canvas.height = 1920; 
    
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 5. 게임 루프
function gameLoop() {
    if(!ctx) return;

    // 배경 클리어
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#f3f4f6"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Helper Functions ---

function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}

function drawPath(ctx, path) {
    if(!path || path.length < 2) return;

    // 도로
    ctx.beginPath();
    ctx.lineWidth = 100; 
    ctx.strokeStyle = "#d1d5db"; 
    ctx.lineCap = "butt"; 
    ctx.lineJoin = "round"; 

    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    
    // 중앙선
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3b82f6";
    ctx.setLineDash([]); 
    
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
}

function drawGrid(ctx, grid) {
    if(!grid) return;
    
    ctx.lineWidth = 2; 
    grid.forEach((cell, idx) => {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#e5e7eb";
        
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

// UI 이벤트 핸들러
window.spawnDice = function() { 
    // SP 체크 및 소환 요청 (추후 구현)
    console.log("Spawn Request"); 
};
window.powerUp = function(idx) { 
    console.log("Power Up:", idx); 
};