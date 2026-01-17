// web/dice/js/game.js

const API_BASE_URL = "https://api.pyosh.cloud/api";

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;

// 1. 페이지 로드 시 초기화
window.onload = async function() {
    console.log("Game Script Loaded.");
    
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';

    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 로딩 시퀀스 시작
    await runLoadingSequence();
};

// 2. 이탈 방지
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
        await sleep(200);

        updateLoading(30, "Fetching User Deck...");
        // [수정됨] 에러 없이 데이터를 불러오도록 수정된 함수 호출
        await initPowerUpUI(); 

        updateLoading(60, "Fetching Map Data...");
        gameMap = getMockMapData(); 
        await sleep(200);

        updateLoading(100, "Ready to Battle!");
        await sleep(200);

        if(loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
        }

        if(uiTop) uiTop.classList.remove('hidden');
        if(uiBottom) {
            uiBottom.classList.remove('hidden');
            uiBottom.classList.add('flex');
        }

        console.log("Game Loop Starting...");
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("Loading Failed:", e);
        // 에러가 나도 게임은 멈추지 않게 처리
    }
}

// [수정됨] 파워업 UI 초기화
async function initPowerUpUI() {
    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    
    if (!username) {
        console.error("로그인 정보(username)를 찾을 수 없습니다.");
        return;
    }

    try {
        console.log(`[Game] Fetching data for ${username}...`);

        // [수정] 절대 경로(API_BASE_URL) 사용
        const [listRes, deckRes] = await Promise.all([
            fetch(`${API_BASE_URL}/dice/list/${username}`),
            fetch(`${API_BASE_URL}/dice/deck/${username}`)
        ]);

        // 에러 확인 (HTML이 왔는지 체크)
        if (!listRes.ok) throw new Error(`List API Error: ${listRes.status}`);
        if (!deckRes.ok) throw new Error(`Deck API Error: ${deckRes.status}`);

        const diceList = await listRes.json();
        const deckData = await deckRes.json();
        
        // 현재 덱 가져오기 (Preset 1번 기준)
        // deckData.decks가 없거나 "1"이 없을 경우 대비
        const currentDeckSlots = deckData.decks && deckData.decks["1"] ? deckData.decks["1"].slots : [];

        if (currentDeckSlots.length === 0) {
            console.warn("장착된 덱이 없습니다.");
            return;
        }

        // UI 그리기
        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        
        currentDeckSlots.forEach((diceId, idx) => {
            if (!uiSlots[idx]) return;

            const diceInfo = diceList.find(d => d.id === diceId);
            if (diceInfo) {
                // [중요] renderDiceIcon의 3번째 인자(pips)로 0을 넘겨 '눈 없는 아이콘' 생성
                // (utils.js가 업데이트 되어 있어야 함)
                const iconHtml = renderDiceIcon(diceInfo, "w-full h-full", 0);
                
                uiSlots[idx].innerHTML = iconHtml;

                // 레벨 표시 덮어쓰기
                const lvBadge = document.createElement('span');
                lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-xs pointer-events-none z-20";
                lvBadge.innerText = `Lv.${diceInfo.class_level}`;
                
                uiSlots[idx].appendChild(lvBadge);
            }
        });
        console.log("Deck Loaded:", currentDeckSlots);

    } catch (err) {
        console.error("PowerUp UI Init Error:", err);
    }
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
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

    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#f3f4f6"; // 배경: 밝은 회색
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
    const width = 1080, height = 1920, unit = 140;
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (5 * unit)) / 2;
    const toPixel = (ux, uy) => ({ x: offsetX + ux * unit, y: offsetY + uy * unit });

    // 역 U자 (∩)
    const logicPath = [ {x: 0.5, y: 4.0}, {x: 0.5, y: -0.5}, {x: 6.5, y: -0.5}, {x: 6.5, y: 4.0} ];
    const path = logicPath.map(p => toPixel(p.x, p.y));

    const grid = [];
    const rows = 3, cols = 5, cellSize = unit * 0.9; 
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const pos = toPixel(1.5 + c, 0.5 + r);
            grid.push({ index: r*cols + c, x: pos.x - cellSize/2, y: pos.y - cellSize/2, w: cellSize, h: cellSize, cx: pos.x, cy: pos.y });
        }
    }
    return { width, height, path, grid };
}

function drawPath(ctx, path) {
    if(path.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 100;
    ctx.strokeStyle = "#d1d5db"; // 도로: 회색
    ctx.lineCap = "butt"; ctx.lineJoin = "round"; 
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3b82f6"; // 중앙선: 파란색
    ctx.setLineDash([]); 
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();
}

function drawGrid(ctx, grid) {
    ctx.lineWidth = 2;
    grid.forEach((cell) => {
        ctx.fillStyle = "#ffffff"; // 슬롯: 흰색
        ctx.strokeStyle = "#e5e7eb";
        const r = 16, x=cell.x, y=cell.y, w=cell.w, h=cell.h;
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        ctx.fill(); ctx.stroke();
    });
}

// UI 함수들
window.spawnDice = function() { console.log("Spawn!"); };
window.powerUp = function(idx) { console.log("Power Up:", idx); };
window.confirmSurrender = function() { if(confirm("나가시겠습니까?")) location.href='index.html'; };