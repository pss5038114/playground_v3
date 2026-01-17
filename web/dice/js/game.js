// web/dice/js/game.js

// [중요] API 주소 설정 (배포 환경 vs 로컬 개발 환경)
// window.location.hostname이 'localhost'나 '127.0.0.1'이면 로컬 API 사용
// 그 외(pyosh.cloud 등)면 배포된 API 주소 사용
const API_BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? "http://localhost:8000/api"      // 로컬 Python 서버
    : "https://api.pyosh.cloud/api";   // 배포된 Cloudflare Tunnel 주소

// 전역 변수 (중복 선언 방지를 위해 window 객체에 할당하거나 var 사용 권장, 여기선 let 유지하되 최상단 배치)
// 만약 'canvas' 에러가 계속 나면 이 파일이 두 번 로드되고 있다는 뜻입니다.
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;

// 전투 상태 변수
let gameSP = 100; 
let inGameDiceLevels = [1, 1, 1, 1, 1]; 
let battleDiceData = []; 

// 1. 페이지 로드
window.onload = async function() {
    console.log(`[Game] Init. API Target: ${API_BASE_URL}`);
    
    // URL 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';

    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

    // 로딩 시작
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

// 3. 로딩 시퀀스
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');
    
    try {
        // 전투 상태 초기화
        gameSP = 100;
        inGameDiceLevels = [1, 1, 1, 1, 1];
        updateSPDisplay();

        updateLoading(10, "Connecting to server...");
        await sleep(300);

        updateLoading(30, "Fetching Deck Info...");
        // 여기서 덱 정보 로드
        await initPowerUpUI(); 

        updateLoading(60, "Loading Map...");
        gameMap = getMockMapData(); 
        await sleep(300);

        updateLoading(100, "Battle Start!");
        await sleep(300);

        // 로딩 화면 제거 & UI 표시
        if(loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);
        }

        if(uiTop) uiTop.classList.remove('hidden');
        if(uiBottom) {
            uiBottom.classList.remove('hidden');
            uiBottom.classList.add('flex');
        }

        console.log("[Game] Loop Starting...");
        if(animationFrameId) cancelAnimationFrame(animationFrameId); // 기존 루프 정지
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("[Game] Fatal Error:", e);
        alert(`게임 로딩 실패!\n${e.message}`);
    }
}

// [핵심] 파워업 UI 및 데이터 로딩
async function initPowerUpUI() {
    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    
    if (!username) {
        console.error("[Game] 로그인 정보 없음");
        // 로그인 안 되어 있으면 테스트용 더미 데이터라도 보여주려면 여기서 처리
        return;
    }

    try {
        // [수정] API_BASE_URL 변수 사용
        const [listRes, deckRes] = await Promise.all([
            fetch(`${API_BASE_URL}/dice/list/${username}`),
            fetch(`${API_BASE_URL}/dice/deck/${username}`)
        ]);

        if (!listRes.ok) throw new Error(`Dice List Error: ${listRes.status}`);
        if (!deckRes.ok) throw new Error(`Deck Info Error: ${deckRes.status}`);

        const diceList = await listRes.json();
        const deckData = await deckRes.json();
        
        // 1번 프리셋 가져오기
        const currentDeckSlots = deckData.decks && deckData.decks["1"] ? deckData.decks["1"].slots : [];

        if (currentDeckSlots.length === 0) {
            console.warn("[Game] 덱 정보가 없습니다.");
            return;
        }

        // 데이터 캐싱
        battleDiceData = currentDeckSlots.map(id => diceList.find(d => d.id === id));

        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        
        // UI 그리기
        currentDeckSlots.forEach((diceId, idx) => {
            const diceInfo = battleDiceData[idx];
            if (!diceInfo || !uiSlots[idx]) return;

            // 아이콘 렌더링 (pips=0, 눈 없음)
            uiSlots[idx].innerHTML = renderDiceIcon(diceInfo, "w-full h-full", 0);

            // 레벨 뱃지
            const lvBadge = document.createElement('span');
            lvBadge.id = `dice-lv-${idx}`;
            lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-sm pointer-events-none z-20 drop-shadow-sm";
            lvBadge.innerText = `Lv.${inGameDiceLevels[idx]}`;
            uiSlots[idx].appendChild(lvBadge);

            // 버튼 업데이트
            updatePowerUpButton(idx);
        });

        console.log("[Game] UI Ready.");

    } catch (err) {
        console.error("[Game] Init UI Error:", err);
        throw err; // 상위 runLoadingSequence에서 잡아서 alert 띄움
    }
}

function updatePowerUpButton(idx) {
    const btns = document.querySelectorAll('#ui-bottom .power-btn');
    if (!btns[idx]) return;

    const level = inGameDiceLevels[idx];
    const btn = btns[idx];
    btn.innerHTML = "";

    if (level >= 5) {
        btn.innerHTML = `<span class="text-xs font-black text-red-400">MAX</span>`;
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    const cost = level * 100;
    btn.innerHTML = `<i class="ri-flashlight-fill text-yellow-500 text-[10px]"></i><span class="text-[10px] text-slate-700 font-bold font-mono ml-0.5">${cost}</span>`;
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

window.powerUp = function(idx) {
    const level = inGameDiceLevels[idx];
    if (level >= 5) return;

    const cost = level * 100;
    if (gameSP < cost) {
        alert("SP 부족!");
        return;
    }

    gameSP -= cost;
    inGameDiceLevels[idx]++;
    
    updateSPDisplay();
    updatePowerUpButton(idx);
    
    const badge = document.getElementById(`dice-lv-${idx}`);
    if(badge) badge.innerText = `Lv.${inGameDiceLevels[idx]}`;
};

function updateSPDisplay() {
    const spEl = document.getElementById('game-sp');
    if (spEl) spEl.innerText = gameSP;
}

window.spawnDice = function() {
    const cost = 10;
    if (gameSP >= cost) {
        gameSP -= cost;
        updateSPDisplay();
        console.log("Spawn!");
    } else {
        alert("SP 부족!");
    }
};

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
    
    let finalW, finalH;
    if (w/h > targetRatio) { finalH = h; finalW = h * targetRatio; } 
    else { finalW = w; finalH = w / targetRatio; }

    canvas.width = 1080;  
    canvas.height = 1920; 
    canvas.style.width = `${finalW}px`;
    canvas.style.height = `${finalH}px`;
}

// 5. 게임 루프
function gameLoop() {
    if(!ctx) return;
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#f3f4f6"; 
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

// Helper Functions
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getMockMapData() {
    const width = 1080, height = 1920, unit = 140;
    const offsetX = (width - (7 * unit)) / 2;
    const offsetY = (height - (5 * unit)) / 2;
    const toPixel = (ux, uy) => ({ x: offsetX + ux * unit, y: offsetY + uy * unit });

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
    ctx.beginPath(); ctx.lineWidth = 100; ctx.strokeStyle = "#d1d5db"; ctx.lineCap = "butt"; ctx.lineJoin = "round"; 
    ctx.moveTo(path[0].x, path[0].y); for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y); ctx.stroke();
    ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = "#3b82f6"; ctx.setLineDash([]); 
    ctx.moveTo(path[0].x, path[0].y); for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y); ctx.stroke();
}

function drawGrid(ctx, grid) {
    ctx.lineWidth = 2;
    grid.forEach((cell) => {
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e5e7eb";
        const r = 16, x=cell.x, y=cell.y, w=cell.w, h=cell.h;
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
        ctx.fill(); ctx.stroke();
    });
}