// web/dice/js/game.js

// 1. API 설정 (auth.js와 동일한 도메인 사용)
const API_BASE_URL = "https://api.pyosh.cloud/api";

// 2. 전역 변수 충돌 방지 (var 사용)
var canvas, ctx;
var gameMap = null;
var currentMode = 'solo';
var animationFrameId;

// 전투 상태 변수
var gameSP = 100; 
var inGameDiceLevels = [1, 1, 1, 1, 1]; 
var battleDiceData = []; 

// 3. 페이지 로드 시작
window.onload = async function() {
    console.log("====================================");
    console.log("[Game] Script Loaded. API:", API_BASE_URL);
    
    try {
        setupLeaveWarning();
        setupCanvas();
        window.addEventListener('resize', setupCanvas);

        // 로딩 시퀀스 진입
        await runLoadingSequence();
        
    } catch (criticalErr) {
        console.error("[Game] Critical Init Error:", criticalErr);
        alert("게임 초기화 중 치명적 오류 발생:\n" + criticalErr.message);
    }
};

// 4. 로딩 시퀀스 (단계별 로그 추가)
async function runLoadingSequence() {
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');
    
    console.log("[Game] Loading Sequence Started...");

    try {
        // Step 1: 초기화
        updateLoading(10, "Initializing...");
        gameSP = 100;
        inGameDiceLevels = [1, 1, 1, 1, 1];
        updateSPDisplay();
        await sleep(200);

        // Step 2: 덱 정보 불러오기
        updateLoading(30, "Fetching Deck Info...");
        console.log("[Game] Calling initPowerUpUI()...");
        await initPowerUpUI(); 
        console.log("[Game] initPowerUpUI() Completed.");

        // Step 3: 맵 로딩
        updateLoading(60, "Loading Map...");
        gameMap = getMockMapData(); 
        await sleep(200);

        // Step 4: 완료
        updateLoading(100, "Battle Start!");
        await sleep(300);

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
        if(animationFrameId) cancelAnimationFrame(animationFrameId);
        requestAnimationFrame(gameLoop);

    } catch (e) {
        console.error("[Game] Loading Failed at Step:", e);
        alert("로딩 중 오류 발생!\nF12 콘솔을 확인해주세요.\n" + e.message);
    }
}

// 5. 파워업 UI 및 데이터 로딩 (가장 중요한 부분)
async function initPowerUpUI() {
    // 세션 스토리지 우선 (로그인 시 저장된 값)
    const username = sessionStorage.getItem('username') || localStorage.getItem('username');
    
    console.log(`[Game] Checking User: ${username}`);
    
    if (!username) {
        console.warn("[Game] No username found. Skipping API fetch.");
        return; // 로그인 안했으면 그냥 리턴 (로딩은 계속 진행)
    }

    try {
        // API 요청
        console.log(`[Game] Fetching from: ${API_BASE_URL}/dice/list/${username}`);
        
        const [listRes, deckRes] = await Promise.all([
            fetch(`${API_BASE_URL}/dice/list/${username}`),
            fetch(`${API_BASE_URL}/dice/deck/${username}`)
        ]);

        console.log(`[Game] API Response Status: List=${listRes.status}, Deck=${deckRes.status}`);

        // HTML 에러 페이지 감지
        const contentType = listRes.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
            const text = await listRes.text();
            console.error("[Game] Server returned HTML instead of JSON:", text.substring(0, 100));
            throw new Error("서버 주소 오류 (HTML 응답)");
        }

        if (!listRes.ok || !deckRes.ok) {
            throw new Error(`API Error: ${listRes.status} / ${deckRes.status}`);
        }

        const diceList = await listRes.json();
        const deckData = await deckRes.json();
        
        console.log("[Game] Data Parsed. Dice Count:", diceList.length);

        // 덱 파싱 (1번 프리셋)
        const currentDeckSlots = deckData.decks && deckData.decks["1"] ? deckData.decks["1"].slots : [];
        console.log("[Game] Current Deck:", currentDeckSlots);

        if (currentDeckSlots.length === 0) {
            console.warn("[Game] Deck is empty.");
            return;
        }

        // 데이터 캐싱
        battleDiceData = currentDeckSlots.map(id => diceList.find(d => d.id === id));

        // UI 렌더링
        const uiSlots = document.querySelectorAll('#ui-bottom .dice-slot');
        if (uiSlots.length === 0) console.warn("[Game] UI Slots not found in DOM");

        currentDeckSlots.forEach((diceId, idx) => {
            const diceInfo = battleDiceData[idx];
            if (!diceInfo || !uiSlots[idx]) return;

            // 아이콘 그리기 (pips=0)
            if (typeof renderDiceIcon === 'function') {
                uiSlots[idx].innerHTML = renderDiceIcon(diceInfo, "w-full h-full", 0);
            } else {
                console.error("[Game] renderDiceIcon function missing! Check utils.js");
                uiSlots[idx].innerText = diceInfo.name;
            }

            // 레벨 배지
            const lvBadge = document.createElement('span');
            lvBadge.id = `dice-lv-${idx}`;
            lvBadge.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-black text-sm pointer-events-none z-20 drop-shadow-sm";
            lvBadge.innerText = `Lv.${inGameDiceLevels[idx]}`;
            uiSlots[idx].appendChild(lvBadge);

            // 버튼 업데이트
            updatePowerUpButton(idx);
        });

    } catch (err) {
        console.error("[Game] initPowerUpUI Failed:", err);
        throw err; // 상위로 에러 전파 (로딩바 멈춤 원인 파악용)
    }
}

// 6. 파워업 버튼 업데이트
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

// 7. 파워업 액션 (HTML에서 호출)
window.powerUp = function(idx) {
    const level = inGameDiceLevels[idx];
    if (level >= 5) return;

    const cost = level * 100;
    if (gameSP < cost) {
        console.log("SP 부족");
        // 버튼 흔들기 효과 등을 넣을 수 있음
        return;
    }

    // 실행
    gameSP -= cost;
    inGameDiceLevels[idx]++;
    
    updateSPDisplay();
    updatePowerUpButton(idx);
    
    const badge = document.getElementById(`dice-lv-${idx}`);
    if(badge) badge.innerText = `Lv.${inGameDiceLevels[idx]}`;

    // 데미지 확인용 로그
    const diceInfo = battleDiceData[idx];
    if (diceInfo) {
        console.log(`[PowerUp] ${diceInfo.name} upgraded to Lv.${inGameDiceLevels[idx]}`);
    }
};

// 8. SP 표시 업데이트
function updateSPDisplay() {
    const spEl = document.getElementById('game-sp');
    if (spEl) spEl.innerText = gameSP;
}

// 9. 소환 버튼
window.spawnDice = function() {
    const cost = 10;
    if (gameSP >= cost) {
        gameSP -= cost;
        updateSPDisplay();
        console.log("Spawn Request!");
    } else {
        console.log("SP 부족");
    }
};

// 10. 이탈 방지
function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

function updateLoading(percent, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt) txt.innerText = text;
    console.log(`[Loading] ${percent}% - ${text}`);
}

// --- Canvas Logic (기존 유지) ---
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

// 헬퍼
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
window.confirmSurrender = function() { if(confirm("나가시겠습니까?")) location.href='index.html'; };