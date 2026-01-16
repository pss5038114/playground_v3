// web/dice/js/game.js

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;
let userDeck = []; // [중요] 서버에서 가져온 완전한 주사위 데이터 객체 배열

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

        // 덱 데이터 불러오기 (서버 원본 데이터 사용)
        updateLoading(50, "Loading User Deck...");
        await fetchUserDeck(); 
        
        // 덱 데이터가 준비되면 하단 UI 렌더링
        if (userDeck && userDeck.length > 0) {
            renderBottomDeckSlots(); 
        } else {
            console.error("User Deck is empty!");
        }
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
    const txt = document.querySelector('#game-loading h2');
    if(bar) bar.style.width = `${percent}%`;
    if(txt && text) txt.innerText = text;
}

// 3. 덱 데이터 가져오기 (API 연동 - 원본 데이터 사용)
async function fetchUserDeck() {
    try {
        // dice_rest_api.py의 get_active_deck 호출
        // 이 API는 game_data.py의 모든 정보를 포함한 완성된 객체를 반환함
        const res = await fetch('/api/dice/deck/active');
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        
        const data = await res.json();
        if (data.deck && Array.isArray(data.deck)) {
            userDeck = data.deck;
            console.log("Deck loaded successfully:", userDeck);
        } else {
            throw new Error("Invalid deck data format");
        }
    } catch (err) {
        console.error("Failed to fetch user deck:", err);
        alert("덱 정보를 불러오는데 실패했습니다. 네트워크를 확인해주세요.");
        // 오류 발생 시 게임 진행 불가 처리 (빈 배열 유지)
        userDeck = [];
    }
}

// [수정됨] 하단 덱 슬롯 렌더링 (utils.js의 renderDiceIcon 사용)
function renderBottomDeckSlots() {
    const slots = document.querySelectorAll('.dice-slot');
    
    userDeck.forEach((dice, index) => {
        if (index >= slots.length) return;
        const slot = slots[index];
        
        // 1. 기존 슬롯 스타일 초기화
        slot.className = 'dice-slot relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden';
        slot.style = ""; 
        
        // 2. utils.js의 renderDiceIcon 함수 사용
        // (dice 객체는 이미 server에서 올바른 color, rarity, symbol 값을 가지고 있음)
        const iconHtml = renderDiceIcon(dice, "w-full h-full");
        
        // 3. 레벨 표시 (카드 위에 오버레이)
        const levelHtml = `
            <div class="absolute bottom-0 right-0 bg-black/60 backdrop-blur-[2px] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-tl-lg z-20 pointer-events-none">
                Lv.${dice.class_level}
            </div>
        `;
        
        // 4. 슬롯에 주입
        slot.innerHTML = iconHtml + levelHtml;
        
        // 클릭 효과 (디버그용 정보 출력)
        slot.onclick = () => {
             console.log(`Selected dice info:`, dice);
             // 예: dice.stats.atk 등을 바로 확인 가능
        };
    });
}

function getFallbackIcon(id) {
    // 이제 서버에서 symbol을 보내주므로 거의 사용되지 않음
    return 'ri-question-mark';
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
