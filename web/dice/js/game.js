// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;
let userDeck = []; // 덱 데이터

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    console.log("Game Script Loaded.");
    
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';
    console.log(`Initializing game in [${currentMode}] mode...`);

    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    await runLoadingSequence();
};

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

// 2. 로딩 시뮬레이션
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    
    try {
        updateLoading(10, "Connecting to server...");
        await sleep(300);

        updateLoading(30, "Fetching map data...");
        gameMap = getMockMapData(); 
        await sleep(300);

        // 덱 데이터 불러오기
        updateLoading(50, "Loading User Deck...");
        await fetchUserDeck(); 
        renderBottomDeckSlots(); // [중요] 주사위 그리기 (흰색 바탕+아이콘)
        await sleep(500);

        updateLoading(80, "Synchronizing...");
        await sleep(400);

        updateLoading(100, "Ready!");
        await sleep(200);

        // 로딩 화면 제거
        if(loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.style.display = 'none', 500);
        }

        console.log("Game Loop Starting...");
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("Loading Failed:", e);
        alert("게임 로딩에 실패했습니다. 로비로 돌아갑니다.");
        window.location.href = 'index.html'; 
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.querySelector('#game-loading h2'); // 텍스트 요소 찾기
    if(bar) bar.style.width = `${percent}%`;
    if(txt && text) txt.innerText = text;
}

// 3. 덱 데이터 가져오기 (API 연동)
async function fetchUserDeck() {
    try {
        // 실제 API 호출 (dice_rest_api.py와 연동)
        const res = await fetch('/api/dice/deck/active');
        if (res.ok) {
            const data = await res.json();
            if (data.deck) {
                userDeck = data.deck;
                console.log("Deck loaded:", userDeck);
                return;
            }
        }
        throw new Error("API response invalid");
    } catch (err) {
        console.warn("Failed to fetch deck from API, using mock data:", err);
        // Fallback: 모의 데이터 (테스트용)
        userDeck = [
            { id: 'fire', name: 'Fire', color: '#ef4444', symbol: 'ri-fire-fill' },     
            { id: 'electric', name: 'Electric', color: '#eab308', symbol: 'ri-flashlight-fill' }, 
            { id: 'wind', name: 'Wind', color: '#10b981', symbol: 'ri-windy-fill' },     
            { id: 'ice', name: 'Ice', color: '#3b82f6', symbol: 'ri-snowflake-fill' },       
            { id: 'poison', name: 'Poison', color: '#a855f7', symbol: 'ri-skull-2-fill' }  
        ];
    }
}

// [수정됨] 하단 덱 슬롯 렌더링 (흰색 바탕 + 색상 테두리 + 아이콘)
function renderBottomDeckSlots() {
    const slots = document.querySelectorAll('.dice-slot');
    
    userDeck.forEach((dice, index) => {
        if (index >= slots.length) return;
        
        const slot = slots[index];
        // 기존 내용(Lv.1 텍스트 등) 유지하면서 스타일 변경
        
        // 1. 스타일 초기화 (기존 클래스 영향 제거)
        slot.className = 'aspect-square rounded-lg relative dice-slot flex items-center justify-center group transition-all duration-200';
        
        // 2. [수정] 흰색 배경 & 색상 테두리 적용 (4cc143 스타일)
        slot.style.backgroundColor = '#ffffff'; // 흰색 바탕
        slot.style.border = `2px solid ${dice.color}`; // 주사위 색상 테두리
        slot.style.boxShadow = `0 2px 5px rgba(0,0,0,0.1)`; // 살짝 그림자

        // 3. 아이콘 추가 (주사위 눈 대신)
        // 기존 아이콘이 있다면 제거
        const oldIcon = slot.querySelector('i');
        if(oldIcon) oldIcon.remove();

        // 새 아이콘 생성
        const iconClass = dice.symbol || getFallbackIcon(dice.id);
        const iconEl = document.createElement('i');
        
        // [수정] 아이콘 색상을 주사위 색상으로 설정
        iconEl.className = `${iconClass} text-3xl`; // 크기 키움
        iconEl.style.color = dice.color; // 아이콘 색상 = 주사위 색상
        
        // 슬롯에 추가 (맨 뒤로 보내지 않고 중앙 배치)
        slot.appendChild(iconEl);
        
        // 4. 레벨 텍스트 스타일 조정 (가독성 확보)
        const levelSpan = slot.querySelector('span');
        if(levelSpan) {
            levelSpan.className = 'absolute bottom-0.5 right-1 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity';
            levelSpan.style.color = '#64748b'; // slate-500
            // 아이콘과 겹치지 않게 호버 시에만 보이거나 구석으로 이동
        }
        
        // 클릭 효과
        slot.onclick = () => {
             // 덱 선택 로직 (필요 시 구현)
             console.log(`Selected dice: ${dice.name}`);
        };
    });
}

function getFallbackIcon(id) {
    switch(id) {
        case 'fire': return 'ri-fire-fill';
        case 'electric': return 'ri-flashlight-fill';
        case 'wind': return 'ri-windy-fill';
        case 'ice': return 'ri-snowflake-fill';
        case 'poison': return 'ri-skull-2-fill';
        default: return 'ri-question-mark';
    }
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

// 5. 게임 루프 (그리기)
function gameLoop() {
    if(!ctx) return;

    // 배경: 밝은 회색
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#f3f4f6"; 
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Helper Functions ---

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

    const logicPath = [
        {x: 0.5, y: 4.0}, 
        {x: 0.5, y: -0.5},
        {x: 6.5, y: -0.5},
        {x: 6.5, y: 4.0} 
    ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

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
    ctx.lineWidth = 100;
    ctx.strokeStyle = "#d1d5db"; // 밝은 회색 길
    ctx.lineCap = "butt"; 
    ctx.lineJoin = "round"; 

    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    
    // 파란색 실선 중앙선
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
    ctx.lineWidth = 2;
    grid.forEach((cell, idx) => {
        // 슬롯 배경: 흰색
        ctx.fillStyle = "#ffffff";
        // 슬롯 테두리: 연한 회색
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
        
        ctx.shadowColor = "rgba(0,0,0,0.05)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        ctx.fill();
        
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