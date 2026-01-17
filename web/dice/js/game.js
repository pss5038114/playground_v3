// web/dice/js/game.js

// [중요] 백엔드 API 주소 고정 (auth.js와 동일하게 설정)
// 사용자님의 배포 환경(Cloudflare Tunnel)에 맞춤
const API_BASE_URL = "https://api.pyosh.cloud/api";

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;

// 전투 상태 변수 (전투 끝나면 초기화됨)
let gameSP = 100; 
let inGameDiceLevels = [1, 1, 1, 1, 1]; // 파워업 레벨 (1~5)
let battleDiceData = []; // 주사위 스탯 정보 캐싱

// 1. 페이지 로드
window.onload = async function() {
    console.log("[Game] Script Loaded. Target API:", API_BASE_URL);
    
    const urlParams = new URLSearchParams(window.location.search);
    currentMode = urlParams.get('mode') || 'solo';

    setupLeaveWarning();
    setupCanvas();
    window.addEventListener('resize', setupCanvas);

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
        // [초기화] 전투 상태 리셋
        gameSP = 100;
        inGameDiceLevels = [1, 1, 1, 1, 1];
        updateSPDisplay();

        updateLoading(10, "Connecting to server...");
        await sleep(200);

        updateLoading(30, "Loading Deck & Stats...");
        // 여기서 덱 정보와 스탯을 가져옴
        await initPowerUpUI(); 

        updateLoading(60, "Loading Map...");
        gameMap = getMockMapData(); 
        await sleep(200);

        updateLoading(100, "Battle Start!");
        await sleep(200);

        // UI 표시
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
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("[Game] Loading Failed:", e);
        alert("게임 로딩 중 오류가 발생했습니다.\n" + e.message);
    }
}

// [핵심] 파워업 UI 초기화 & 데이터 로딩
async function initPowerUpUI() {
    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    
    if (!username) {
        console.error("[Game] User not logged in.");
        return;
    }

    try {
        // 병렬 요청으로 덱과 주사위 목록 가져오기
        const [listRes, deckRes] = await Promise.all([
            fetch(`${API_BASE_URL}/dice/list/${username}`),
            fetch(`${API_BASE_URL}/dice/deck/${username}`)
        ]);

        if (!listRes.ok) throw new Error("주사위 목록 로딩 실패");
        if (!deckRes.ok) throw new Error("덱 정보 로딩 실패");

        const diceList = await listRes.json();
        const deckData = await deckRes.json();
        
        // 현재 장착된 덱 (1번 프리셋)
        const currentDeckSlots = deckData.decks && deckData.decks["1"] ? deckData.decks["1"].slots : [];

        if (currentDeckSlots.length === 0) {
            console.warn("[Game] 덱이 비어있습니다.");
            return;
        }

        // [중요] 전투용 데이터 캐싱 (id로 상세 정보 찾아서 저장)
        battleDiceData = currentDeckSlots.map(id => diceList.find(d => d.id === id));

        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        
        // UI 그리기
        currentDeckSlots.forEach((diceId, idx) => {
            const diceInfo = battleDiceData[idx];
            if (!diceInfo || !uiSlots[idx]) return;

            // 1. 주사위 아이콘 (눈 없음: pips=0)
            uiSlots[idx].innerHTML = renderDiceIcon(diceInfo, "w-full h-full", 0);

            // 2. 레벨 뱃지 (파워업 레벨)
            const lvBadge = document.createElement('span');
            lvBadge.id = `dice-lv-${idx}`;
            lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-sm pointer-events-none z-20 drop-shadow-sm";
            lvBadge.innerText = `Lv.${inGameDiceLevels[idx]}`; // 초기값 1
            uiSlots[idx].appendChild(lvBadge);

            // 3. 버튼 초기화
            updatePowerUpButton(idx);
        });

        console.log("[Game] PowerUp UI Ready.");

    } catch (err) {
        console.error("[Game] Init Error:", err);
        throw err; // runLoadingSequence에서 잡도록 던짐
    }
}

// [기능] 파워업 버튼 업데이트 (비용 표시 / MAX 처리)
function updatePowerUpButton(idx) {
    const btns = document.querySelectorAll('#ui-bottom .power-btn');
    if (!btns[idx]) return;

    const level = inGameDiceLevels[idx];
    const btn = btns[idx];
    
    btn.innerHTML = "";

    // 최대 레벨(5) 체크 (충전 주사위 예외 처리는 나중에 추가 가능)
    if (level >= 5) {
        btn.innerHTML = `<span class="text-xs font-black text-red-400">MAX</span>`;
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        return;
    }

    // 비용 계산: 현재레벨 * 100 (1->2: 100, 2->3: 200...)
    const cost = level * 100;
    
    // 버튼 UI
    btn.innerHTML = `
        <i class="ri-flashlight-fill text-yellow-500 text-[10px]"></i>
        <span class="text-[10px] text-slate-700 font-bold font-mono ml-0.5">${cost}</span>
    `;
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// [액션] 파워업 실행 (HTML onclick 연결)
window.powerUp = function(idx) {
    const level = inGameDiceLevels[idx];
    
    if (level >= 5) return;

    const cost = level * 100;
    
    if (gameSP < cost) {
        // SP 부족 시각 효과 (버튼 흔들기 등 - 추후 구현)
        alert("SP가 부족합니다!");
        return;
    }

    // 실행
    gameSP -= cost;
    inGameDiceLevels[idx]++;
    
    // UI 갱신
    updateSPDisplay();
    updatePowerUpButton(idx);
    
    // 레벨 뱃지 갱신
    const badge = document.getElementById(`dice-lv-${idx}`);
    if (badge) badge.innerText = `Lv.${inGameDiceLevels[idx]}`;

    // 데미지 계산 로그 (검증용)
    const diceInfo = battleDiceData[idx];
    if (diceInfo) {
        // 공식: base + (class-1)*c + (powerup-1)*p
        // diceInfo에 서버에서 받은 c, p 값이 있다고 가정 (없으면 기본값 0)
        const base = diceInfo.base_atk || 10;
        const c = diceInfo.atk_per_lvl || 0; // 클래스업 계수
        const p = diceInfo.p || 10;          // 파워업 계수 (임시값, 서버 데이터 확인 필요)
        const classLv = diceInfo.class_level || 1;
        const powerLv = inGameDiceLevels[idx];

        const damage = base + (classLv - 1) * c + (powerLv - 1) * p;
        console.log(`[PowerUp] ${diceInfo.name}: Lv.${powerLv} -> DMG: ${damage}`);
    }
};

// [UI] SP 표시 갱신
function updateSPDisplay() {
    const spEl = document.getElementById('game-sp');
    if (spEl) spEl.innerText = gameSP;
}

// ... (기존 캔버스 설정, 맵 데이터, 그리기 함수들 그대로 유지) ...
// (위쪽 코드에 이어붙여 사용하시면 됩니다)

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
}

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
    if (containerRatio > targetRatio) { finalH = h; finalW = h * targetRatio; } 
    else { finalW = w; finalH = w / targetRatio; }
    canvas.width = 1080; canvas.height = 1920; 
    canvas.style.width = `${finalW}px`; canvas.style.height = `${finalH}px`;
}

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

// UI 함수들
window.spawnDice = function() { 
    const cost = 10;
    if(gameSP >= cost) {
        gameSP -= cost;
        updateSPDisplay();
        console.log("Spawn!"); 
    } else {
        alert("SP가 부족합니다.");
    }
};
window.confirmSurrender = function() { if(confirm("나가시겠습니까?")) location.href='index.html'; };