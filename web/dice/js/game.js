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
        
        // [API 호출] 게임 시작
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
    if(bar) bar.style.width = `${percent}%`;
}

// [UI 초기화 함수 - 수정됨]
function initGameUI(state, deckList) {
    // 1. 상단 정보
    document.getElementById('game-wave').innerText = state.wave;
    document.getElementById('game-lives').innerText = state.lives;
    document.getElementById('game-sp').innerText = state.sp;
    
    // 2. 덱 슬롯 렌더링 (하단 바)
    const slots = document.querySelectorAll('.dice-slot');
    
    deckList.forEach((dice, idx) => {
        if (idx >= slots.length) return;
        const slot = slots[idx];
        
        // [수정] 클릭 가능한 버튼 스타일 추가 (active:scale-95)
        slot.className = "aspect-square relative dice-slot flex items-center justify-center cursor-pointer transition-transform active:scale-95 select-none";
        
        // 기존 Lv 텍스트 가져오기 (없으면 1)
        const lvSpan = slot.querySelector('span');
        let currentLvText = 'Lv.1';
        if (lvSpan && lvSpan.innerText.includes('Lv.')) {
            currentLvText = lvSpan.innerText;
        }
        
        // [NEW] 동적 폰트 크기 계산 (슬롯 너비의 40% 정도)
        const slotWidth = slot.clientWidth || 80; // 기본값 80px 가정
        const fontSize = Math.floor(slotWidth * 0.4); 

        // 눈 없는 주사위 생성
        const diceHtml = renderDiceIcon(dice, "w-full h-full", 0);
        
        // [수정] 중앙 정렬 및 큰 폰트로 Lv 표시
        slot.innerHTML = `
            ${diceHtml}
            <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <span style="font-size: ${fontSize}px; line-height: 1;" class="text-white font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    ${currentLvText}
                </span>
            </div>
        `;
        
        // [NEW] 슬롯 전체 클릭 시 파워업 실행
        slot.onclick = () => {
            if(window.powerUp) window.powerUp(idx);
        };
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
    console.log("Spawn Request"); 
};

// [수정] 파워업 로직 (테스트용 콘솔 출력 및 Lv 증가 시뮬레이션)
window.powerUp = function(idx) { 
    console.log("Power Up Triggered for Index:", idx);
    
    // UI 업데이트 시뮬레이션 (실제로는 서버 통신 후 갱신해야 함)
    const slots = document.querySelectorAll('.dice-slot');
    if(slots[idx]) {
        const span = slots[idx].querySelector('span');
        if(span) {
            let lv = parseInt(span.innerText.replace('Lv.', '')) || 1;
            span.innerText = `Lv.${lv + 1}`;
            
            // 클릭 효과음이나 파티클 등을 여기에 추가 가능
        }
    }
};