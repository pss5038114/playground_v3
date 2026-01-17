// web/dice/js/game.js

// ----------------------------------------------------------------------
// 전역 변수
// ----------------------------------------------------------------------
let canvas, ctx;
let gameMap = null;
let gameState = null; // 서버에서 받은 게임 상태 (SP, Lives, Wave, Grid 등)
let currentMode = 'solo';
let animationFrameId;

// 네트워크 관련
let socket = null;
let gameId = null;
let deckInfoMap = {}; // ID -> 덱 상세정보(색상, 아이콘 등) 캐싱

const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// ----------------------------------------------------------------------
// 1. 초기화 (Window Load)
// ----------------------------------------------------------------------
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

    // 캔버스 크기 설정 (반응형)
    setupCanvas();
    window.addEventListener('resize', () => {
        setupCanvas();
        // 리사이즈 시 그리드 슬롯 위치도 재조정
        if (gameMap && gameMap.grid) {
            gameMap.grid.forEach((cell, idx) => {
                const slot = document.getElementById(`grid-slot-${idx}`);
                if (slot) updateSlotPosition(slot, cell);
            });
        }
    });

    // 로딩 시퀀스 시작
    await runLoadingSequence(presetIndex);
};

function setupLeaveWarning() {
    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = ''; 
        return '';
    });
}

// ----------------------------------------------------------------------
// 2. 게임 시작 및 로딩 (HTTP -> WebSocket)
// ----------------------------------------------------------------------
async function runLoadingSequence(presetIndex) {
    const loadingScreen = document.getElementById('game-loading');
    
    try {
        updateLoading(10, "Connecting to server...");
        await sleep(300);

        updateLoading(30, "Creating Game Session...");
        
        // 1. HTTP로 게임 세션 생성 요청
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
        
        // 세션 정보 저장
        gameId = data.game_id;
        // deck_details를 맵으로 변환하여 빠른 조회 가능하게 함
        data.deck_details.forEach(d => { deckInfoMap[d.id] = d; });

        updateLoading(50, "Connecting to Realtime Server...");
        
        // 2. 웹소켓 연결 시작
        connectWebSocket(gameId, data.deck_details);

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

// ----------------------------------------------------------------------
// 3. WebSocket 연결 및 핸들러
// ----------------------------------------------------------------------
function connectWebSocket(gid, deckDetails) {
    // 프로토콜 자동 감지 (https -> wss, http -> ws)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/game/${gid}`;
    
    console.log("Connecting WS:", wsUrl);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("WebSocket Connected");
        updateLoading(90, "Synchronizing...");
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg, deckDetails);
    };

    socket.onclose = (e) => {
        console.warn("WebSocket Closed:", e);
        alert("서버 연결이 끊어졌습니다.");
        window.location.href = 'index.html';
    };
    
    socket.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };
}

// 서버 메시지 라우터
function handleServerMessage(msg, deckDetails) {
    if (msg.type === 'INIT') {
        // [초기화 메시지]
        gameMap = msg.map;
        gameState = msg.state;
        
        // 맵(그리드 레이어) 생성
        initDiceLayer();
        
        // UI 초기화 및 로딩 종료
        finalizeLoading(gameState, deckDetails);
        
        // 초기 정보 갱신
        updateGameInfoUI();
        syncGrid(msg.state.grid);
        
    } else if (msg.type === 'STATE_UPDATE') {
        // [상태 업데이트] 30Hz 등 주기적 수신
        gameState = msg;
        updateGameInfoUI();
        syncGrid(msg.grid);
    }
}

// 로딩 완료 처리
function finalizeLoading(state, deckDetails) {
    updateLoading(100, "Ready!");
    
    const loadingScreen = document.getElementById('game-loading');
    const uiTop = document.getElementById('ui-top');
    const uiBottom = document.getElementById('ui-bottom');

    // UI 하단 덱 초기화
    initGameUI(state, deckDetails);

    // 로딩 화면 제거 및 UI 표시
    loadingScreen.style.opacity = '0';
    loadingScreen.style.pointerEvents = 'none';
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);

    if(uiTop) uiTop.classList.remove('hidden');
    if(uiBottom) {
        uiBottom.classList.remove('hidden');
        uiBottom.classList.add('flex');
    }

    // 게임 렌더링 루프 시작 (Canvas)
    requestAnimationFrame(gameLoop);
}

// ----------------------------------------------------------------------
// 4. UI 및 그리드 렌더링
// ----------------------------------------------------------------------

// 상단/하단 텍스트 정보 갱신
function updateGameInfoUI() {
    if(!gameState) return;
    document.getElementById('game-wave').innerText = gameState.wave;
    document.getElementById('game-lives').innerText = gameState.lives;
    document.getElementById('game-sp').innerText = gameState.sp;
    
    // (선택) 소환 버튼의 비용 표시 업데이트
    // const spawnBtn = document.querySelector('.spawn-btn span');
    // if(spawnBtn) spawnBtn.innerText = gameState.spawn_cost;
}

// 하단 덱 슬롯 초기화
function initGameUI(state, deckList) {
    const slots = document.querySelectorAll('.dice-slot');
    
    deckList.forEach((dice, idx) => {
        if (idx >= slots.length) return;
        const slot = slots[idx];
        
        // 클릭 가능한 스타일
        slot.className = "aspect-square relative dice-slot flex items-center justify-center cursor-pointer transition-transform active:scale-95 select-none";
        
        // 현재 레벨 텍스트 (초기값 Lv.1)
        let currentLvText = 'Lv.1';
        const existingSpan = slot.querySelector('span');
        if (existingSpan && existingSpan.innerText.includes('Lv.')) {
            currentLvText = existingSpan.innerText;
        }
        
        // 동적 폰트 크기 (슬롯 너비의 40%)
        const slotWidth = slot.clientWidth || 80; 
        const fontSize = Math.floor(slotWidth * 0.4); 

        // 눈 없는 주사위(0) 생성 - 배경/디자인용
        const diceHtml = renderDiceIcon(dice, "w-full h-full", 0);
        
        slot.innerHTML = `
            ${diceHtml}
            <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <span style="font-size: ${fontSize}px; line-height: 1;" class="text-white font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    ${currentLvText}
                </span>
            </div>
        `;
        
        // 파워업 핸들러 연결
        slot.onclick = () => {
            if(window.powerUp) window.powerUp(idx);
        };
    });
}

// 주사위 표시용 HTML 레이어 생성 (Canvas 위에 얹음)
function initDiceLayer() {
    const container = document.getElementById('game-container');
    let layer = document.getElementById('dice-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'dice-layer';
        layer.className = 'absolute inset-0 pointer-events-none'; // 클릭 통과
        container.appendChild(layer);
    }
    layer.innerHTML = ''; // 초기화
    
    if (gameMap && gameMap.grid) {
        gameMap.grid.forEach((cell, idx) => {
            const slot = document.createElement('div');
            slot.id = `grid-slot-${idx}`;
            // 주사위 슬롯 스타일 (중앙 정렬, 애니메이션)
            slot.className = 'absolute flex items-center justify-center transition-all duration-200 pointer-events-auto cursor-pointer';
            
            // 위치 잡기
            updateSlotPosition(slot, cell);
            
            // (선택) 그리드 슬롯 클릭 시 합치기 등의 로직을 위한 핸들러
            slot.onclick = () => onGridSlotClick(idx);
            
            layer.appendChild(slot);
        });
    }
}

// 그리드 상태 동기화 (서버 -> 클라이언트)
function syncGrid(serverGridData) {
    // serverGridData: [ {id:'fire', level:1}, null, ... ]
    if (!serverGridData) return;

    serverGridData.forEach((diceData, idx) => {
        const slot = document.getElementById(`grid-slot-${idx}`);
        if (!slot) return;

        const currentId = slot.dataset.diceId;
        const currentLevel = slot.dataset.diceLevel;

        if (diceData) {
            // 변경사항이 있을 때만 렌더링 (성능 최적화)
            if (currentId !== diceData.id || currentLevel != diceData.level) {
                const diceInfo = deckInfoMap[diceData.id];
                if (diceInfo) {
                    // w-full h-full로 부모 크기에 맞춤
                    const html = renderDiceIcon(diceInfo, "w-full h-full", diceData.level);
                    slot.innerHTML = html;
                    slot.dataset.diceId = diceData.id;
                    slot.dataset.diceLevel = diceData.level;
                    
                    // 생성 애니메이션 (Pop)
                    if (!currentId) { 
                        slot.classList.add('scale-0');
                        setTimeout(() => slot.classList.remove('scale-0'), 50);
                    }
                }
            }
        } else {
            // 서버엔 없는데 클라엔 있다면 -> 삭제
            if (currentId) {
                slot.innerHTML = '';
                delete slot.dataset.diceId;
                delete slot.dataset.diceLevel;
            }
        }
    });
}

function updateSlotPosition(element, cell) {
    if (!canvas) return;
    // 캔버스 실제 크기 / 내부 해상도(1080)
    const scale = canvas.clientWidth / 1080; 
    
    element.style.left = `${cell.x * scale}px`;
    element.style.top = `${cell.y * scale}px`;
    element.style.width = `${cell.w * scale}px`;
    element.style.height = `${cell.h * scale}px`;
}

// ----------------------------------------------------------------------
// 5. 캔버스 렌더링 (맵, 경로 등)
// ----------------------------------------------------------------------
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

function gameLoop() {
    if(!ctx) return;

    // 배경 지우기 & 다시 그리기
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#f3f4f6"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기 (경로, 그리드 박스 등)
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function drawPath(ctx, path) {
    if(!path || path.length < 2) return;

    // 도로 (회색)
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
    
    // 중앙선 (파란색 점선 등)
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
    
    // 그리드 영역 표시 (디버깅 또는 시각적 가이드)
    ctx.lineWidth = 2; 
    grid.forEach((cell) => {
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

// ----------------------------------------------------------------------
// 6. 사용자 입력 핸들러 (WebSocket 전송)
// ----------------------------------------------------------------------

// 소환 버튼 클릭
window.spawnDice = function() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "SPAWN" }));
        
        // (선택) 버튼 클릭 애니메이션 (즉각적인 피드백)
        // const btn = document.querySelector('.spawn-btn');
        // if(btn) ...
    } else {
        console.warn("Socket not open");
    }
};

// 파워업 버튼(슬롯) 클릭
window.powerUp = function(idx) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("Power Up Request:", idx);
        socket.send(JSON.stringify({ type: "POWER_UP", index: idx }));
    }
};

// 그리드 슬롯 클릭 (나중에 머지 기능 구현 시 사용)
function onGridSlotClick(idx) {
    console.log("Grid Clicked:", idx);
    // 선택된 주사위가 있다면 머지 요청 전송 등
}

// ----------------------------------------------------------------------
// 7. 유틸리티
// ----------------------------------------------------------------------
function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}