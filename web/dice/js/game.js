// web/dice/js/game.js

const API_BASE_URL = "https://api.pyosh.cloud/api";

// 전역 변수
let canvas, ctx;
let gameMap = null;
let currentMode = 'solo';
let animationFrameId;
let gameSP = 100; // 초기 SP (나중에 서버와 동기화 필요)
let inGameDiceLevels = [1, 1, 1, 1, 1]; // 슬롯별 파워업 레벨 (1~5)
let battleDiceData = []; // 현재 덱의 주사위 스탯 정보 저장용

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
    // [중요] 전투 시작 시 상태 초기화
    gameSP = 100;
    inGameDiceLevels = [1, 1, 1, 1, 1];
    updateSPDisplay(); // SP 화면 갱신

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

// [수정됨] 파워업 UI 초기화 & 데이터 저장
async function initPowerUpUI() {
    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    if (!username) return;

    try {
        const [listRes, deckRes] = await Promise.all([
            fetch(`/api/dice/list/${username}`), // 상세 스탯(p값 등) 포함
            fetch(`/api/dice/deck/${username}`)
        ]);

        if (!listRes.ok || !deckRes.ok) return;

        const diceList = await listRes.json();
        const deckData = await deckRes.json();
        const currentDeckSlots = deckData.decks && deckData.decks["1"] ? deckData.decks["1"].slots : [];

        if (currentDeckSlots.length === 0) return;

        // [중요] 전투용 데이터 캐싱 (나중에 데미지 계산 때 씀)
        battleDiceData = currentDeckSlots.map(id => diceList.find(d => d.id === id));

        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        const powerBtns = document.querySelectorAll('#ui-bottom .power-btn'); // 버튼들

        currentDeckSlots.forEach((diceId, idx) => {
            const diceInfo = battleDiceData[idx];
            if (!diceInfo || !uiSlots[idx]) return;

            // 1. 주사위 아이콘 그리기 (눈 없음)
            uiSlots[idx].innerHTML = renderDiceIcon(diceInfo, "w-full h-full", 0);

            // 2. [변경] 클래스 레벨 대신 '파워업 레벨(Lv.1)' 표시
            // 기존 span 제거 후 새로 생성
            const oldSpan = uiSlots[idx].querySelector('span');
            if(oldSpan) oldSpan.remove();

            const lvBadge = document.createElement('span');
            lvBadge.id = `dice-lv-${idx}`; // 나중에 업데이트를 위해 ID 부여
            lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-sm pointer-events-none z-20 drop-shadow-sm"; // 글씨 크기 키움 (text-xs -> text-sm)
            lvBadge.innerText = `Lv.${inGameDiceLevels[idx]}`; 
            uiSlots[idx].appendChild(lvBadge);

            // 3. [신규] 버튼 초기화 (비용 표시)
            updatePowerUpButton(idx);
        });

    } catch (err) {
        console.error("PowerUp UI Init Error:", err);
    }
}

// [신규] 파워업 버튼 상태 업데이트 함수
function updatePowerUpButton(idx) {
    const btns = document.querySelectorAll('#ui-bottom .power-btn');
    if (!btns[idx]) return;

    const level = inGameDiceLevels[idx];
    const btn = btns[idx];
    
    // 기존 내용 비우기
    btn.innerHTML = "";

    // 최대 레벨 체크
    if (level >= 5) {
        btn.innerHTML = `<span class="text-xs font-black text-red-400">MAX</span>`;
        btn.disabled = true;
        return;
    }

    // 다음 레벨 비용 계산 (Lv.1 -> 100, Lv.2 -> 200...)
    const cost = level * 100;
    
    // 버튼 내용 (번개 아이콘 + 비용)
    btn.innerHTML = `
        <i class="ri-flashlight-fill text-yellow-500 text-[10px]"></i>
        <span class="text-[10px] text-slate-700 font-bold font-mono ml-0.5">${cost}</span>
    `;
    btn.disabled = false;
}

// [신규] 파워업 액션 함수 (HTML onclick="powerUp(0)" 등에서 호출)
window.powerUp = function(idx) {
    const level = inGameDiceLevels[idx];
    
    // 1. 만렙 체크
    if (level >= 5) {
        console.log("Max Level Reached");
        return;
    }

    // 2. 비용 체크
    const cost = level * 100;
    if (gameSP < cost) {
        // SP 부족 효과 (흔들림 등) 주면 좋음
        console.log("Not enough SP");
        alert("SP가 부족합니다!"); // 임시 알림
        return;
    }

    // 3. 실행
    gameSP -= cost;
    inGameDiceLevels[idx]++; // 레벨 증가
    
    // 4. UI 갱신
    updateSPDisplay();
    updatePowerUpButton(idx); // 버튼 비용 갱신
    
    // 주사위 위 레벨 텍스트 갱신
    const badge = document.getElementById(`dice-lv-${idx}`);
    if (badge) badge.innerText = `Lv.${inGameDiceLevels[idx]}`;

    // [디버그] 스탯 변화 로그 출력
    const diceInfo = battleDiceData[idx];
    if (diceInfo && diceInfo.atk) {
        // 공격력 공식: base + (class_lv-1)*c + (power_up-1)*p
        // diceInfo.atk는 객체임 {base:20, c:..., p:15} 라고 가정
        // 하지만 보통 API 응답은 평탄화되어 오거나 구조가 다를 수 있으니 game_data.py 구조를 따름
        // 여기선 간단히 로그만 찍습니다.
        console.log(`[PowerUp] ${diceInfo.name} Lv.${level} -> Lv.${level+1}`);
    }
};

// [신규] SP 표시 갱신
function updateSPDisplay() {
    const spEl = document.getElementById('game-sp');
    if (spEl) spEl.innerText = gameSP;
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