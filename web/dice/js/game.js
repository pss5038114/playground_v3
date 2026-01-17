// web/dice/js/game.js

// ----------------------------------------------------------------------
// 전역 변수
// ----------------------------------------------------------------------
let canvas, ctx;
let gameMap = null;
let gameState = null; // 서버에서 받은 게임 상태 (SP, Lives, Wave, Grid 등)
let currentMode = 'solo';
let animationFrameId;
let selectedGridIndex = null; // [NEW] 현재 선택된 주사위 인덱스

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
        // 개발 중엔 불편할 수 있으니 주석 처리 가능
        // event.preventDefault();
        // event.returnValue = ''; 
        // return '';
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
        if(data.deck_details) {
            data.deck_details.forEach(d => { deckInfoMap[d.id] = d; });
        }

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
    const txt = document.getElementById('loading-text');
    if(bar) bar.style.width = `${percent}%`;
    if(txt && text) txt.innerText = text;
}

// ----------------------------------------------------------------------
// 3. WebSocket 연결 및 핸들러
// ----------------------------------------------------------------------
function connectWebSocket(gid, deckDetails) {
    try {
        const apiObj = new URL(API_DICE);
        const protocol = apiObj.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = apiObj.host;
        const wsUrl = `${protocol}//${host}/ws/game/${gid}`;
        
        console.log("Connecting WS:", wsUrl);
        socket = new WebSocket(wsUrl);
    } catch (e) {
        console.error("Invalid API URL:", e);
        return;
    }

    socket.onopen = () => {
        console.log("WebSocket Connected");
        updateLoading(90, "Synchronizing...");
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg, deckDetails);
    };

    socket.onclose = (e) => {
        console.warn("WebSocket Closed:", e.code, e.reason);
        if (e.code !== 1000) {
            // alert("서버 연결이 종료되었습니다.");
            // window.location.href = 'index.html';
        }
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
        if(gameState.grid) syncGrid(gameState.grid);
        
    } else if (msg.type === 'STATE_UPDATE') {
        // [상태 업데이트] 30Hz 등 주기적 수신
        gameState = msg;
        updateGameInfoUI();
        if(msg.grid) syncGrid(msg.grid);
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
    updateGameInfoUI(); // SP 등 텍스트 갱신

    // 로딩 화면 제거
    loadingScreen.style.opacity = '0';
    loadingScreen.style.pointerEvents = 'none';
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 500);

    // [수정] UI 표시 (hidden 제거 및 애니메이션 클래스 처리)
    if(uiTop) {
        uiTop.classList.remove('hidden');
    }
    
    if(uiBottom) {
        uiBottom.classList.remove('hidden');
        uiBottom.classList.add('flex'); // flex 유지
        
        // 약간의 딜레이 후 슬라이드 업 (CSS transition 적용을 위해)
        setTimeout(() => {
            uiBottom.classList.remove('translate-y-full');
        }, 50);
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
    
    const waveEl = document.getElementById('game-wave');
    const livesEl = document.getElementById('game-lives');
    const spEl = document.getElementById('game-sp');
    const costEl = document.getElementById('spawn-cost-text'); // 소환 버튼 내 텍스트

    if(waveEl) waveEl.innerText = gameState.wave;
    if(livesEl) livesEl.innerText = gameState.lives;
    if(spEl) spEl.innerText = gameState.sp;
    if(costEl && gameState.spawn_cost) costEl.innerText = gameState.spawn_cost;
}

// [수정] 하단 덱 슬롯 초기화
function initGameUI(state, deckList) {
    const slots = document.querySelectorAll('.dice-slot');
    
    if(!deckList) return;

    deckList.forEach((dice, idx) => {
        if (idx >= slots.length) return;
        const slot = slots[idx];
        
        slot.className = "aspect-square relative dice-slot flex items-center justify-center cursor-pointer transition-transform active:scale-95 select-none";
        
        let currentLvText = 'Lv.1';
        const existingSpan = slot.querySelector('span');
        if (existingSpan && existingSpan.innerText.includes('Lv.')) {
            currentLvText = existingSpan.innerText;
        }
        
        // [핵심 수정]
        // 슬롯이 숨겨져 있어 width가 0일 수 있음.
        // 0이면 renderDiceIcon에 0을 전달 -> utils.js가 w-full 기본값(100px) 사용 -> 테두리 두껍게 나옴!
        // 기존엔 || 60 처럼 작은 값을 넣어서 얇게 나왔었음.
        const slotWidth = slot.clientWidth; 
        
        // 폰트 크기는 어쩔 수 없이 추정치 사용 (보통 80px 이상임)
        const fontSize = Math.floor((slotWidth || 80) * 0.4); 

        // 4번째 인자로 slotWidth(0 또는 실제값) 전달
        const diceHtml = renderDiceIcon(dice, "w-full h-full", 0, slotWidth);
        
        slot.innerHTML = `
            ${diceHtml}
            <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <span style="font-size: ${fontSize}px; line-height: 1;" class="text-white font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    ${currentLvText}
                </span>
            </div>
        `;
        
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
            
            // [수정] 클릭 이벤트 연결
            slot.onclick = () => onGridSlotClick(idx);
            
            layer.appendChild(slot);
        });
    }
}

// [NEW] 그리드 슬롯 클릭 핸들러
function onGridSlotClick(idx) {
    if (!gameState || !gameState.grid) return;
    
    const clickedDice = gameState.grid[idx];
    const slotEl = document.getElementById(`grid-slot-${idx}`);

    // 1. 이미 선택된 것이 있는 경우 (결합 시도 or 선택 변경)
    if (selectedGridIndex !== null) {
        // 같은 거 다시 클릭 -> 선택 해제
        if (selectedGridIndex === idx) {
            deselectDice();
            return;
        }
        
        const sourceIdx = selectedGridIndex;
        const sourceDice = gameState.grid[sourceIdx];
        
        // 결합 조건 확인 (클라이언트 측 1차 검증: 같은 ID, 같은 레벨)
        // 실제 로직은 서버에 있지만, 반응성을 위해 기본 규칙은 여기서 체크
        if (clickedDice && sourceDice && 
            clickedDice.id === sourceDice.id && 
            clickedDice.level === sourceDice.level) {
            
            // [결합 요청 전송]
            console.log(`Merging ${sourceIdx} -> ${idx}`);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    type: "MERGE", 
                    source_index: sourceIdx, 
                    target_index: idx 
                }));
            }
            
            // 선택 해제
            deselectDice();
            return;
        }
        
        // 결합 불가능한 대상을 클릭함 -> 선택 대상 변경 (빈칸이 아니면)
        if (clickedDice) {
            selectDice(idx);
        } else {
            deselectDice(); // 빈칸 클릭 시 해제
        }
    } 
    // 2. 아무것도 선택되지 않은 상태 (새로운 선택)
    else {
        if (clickedDice) {
            selectDice(idx);
        }
    }
}

// [NEW] 선택 처리 (하이라이트)
function selectDice(idx) {
    deselectDice(); // 기존 것 해제
    
    selectedGridIndex = idx;
    const slot = document.getElementById(`grid-slot-${idx}`);
    if (slot) {
        // 선택된 주사위 강조 (파란 테두리 + 살짝 커짐)
        slot.classList.add('scale-110', 'z-20');
        slot.style.filter = "drop-shadow(0 0 5px #3b82f6)";
    }
    
    // 결합 가능한 대상 하이라이트
    highlightMergeableTargets(idx);
}

// [NEW] 선택 해제
function deselectDice() {
    if (selectedGridIndex !== null) {
        const slot = document.getElementById(`grid-slot-${selectedGridIndex}`);
        if (slot) {
            slot.classList.remove('scale-110', 'z-20');
            slot.style.filter = "";
        }
    }
    selectedGridIndex = null;
    clearHighlights();
}

// [NEW] 결합 가능 대상 표시
function highlightMergeableTargets(sourceIdx) {
    const sourceDice = gameState.grid[sourceIdx];
    if (!sourceDice) return;
    
    gameState.grid.forEach((targetDice, idx) => {
        if (idx === sourceIdx) return; // 자기 자신 제외
        
        // 기본 결합 규칙 체크 (같은 ID, 같은 레벨)
        if (targetDice && 
            targetDice.id === sourceDice.id && 
            targetDice.level === sourceDice.level) {
            
            const targetSlot = document.getElementById(`grid-slot-${idx}`);
            if (targetSlot) {
                // 하이라이트 효과 (반짝임)
                targetSlot.classList.add('animate-pulse');
                targetSlot.style.filter = "drop-shadow(0 0 5px #ef4444)"; // 붉은색 힌트
            }
        }
    });
}

// [NEW] 하이라이트 제거
function clearHighlights() {
    const slots = document.querySelectorAll('[id^="grid-slot-"]');
    slots.forEach(slot => {
        slot.classList.remove('animate-pulse');
        // 선택된 놈 빼고 필터 제거 (선택된 놈은 selectDice에서 관리)
        if (selectedGridIndex === null || slot.id !== `grid-slot-${selectedGridIndex}`) {
            slot.style.filter = "";
        }
    });
}

// ----------------------------------------------------------------------
// [수정] 그리드 상태 동기화 (필드 주사위)
// ----------------------------------------------------------------------
// 그리드 상태 동기화 (서버 -> 클라이언트)
function syncGrid(serverGridData) {
    if (!serverGridData) return;

    // 현재 캔버스의 축소 비율 계산 (원본 1080px 대비 현재 크기)
    const scale = canvas ? (canvas.clientWidth / 1080) : 1;

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
                    // 필드 주사위 크기 계산 (비율 적용)
                    let realSizePx = 80; 
                    if (gameMap && gameMap.grid && gameMap.grid[idx]) {
                        realSizePx = gameMap.grid[idx].w * scale;
                    }

                    // 4번째 인자로 realSizePx 전달
                    const html = renderDiceIcon(diceInfo, "w-full h-full", diceData.level, realSizePx);
                    
                    slot.innerHTML = html;
                    slot.dataset.diceId = diceData.id;
                    slot.dataset.diceLevel = diceData.level;
                    
                    // 생성 애니메이션 (Pop)
                    if (!currentId) { 
                        slot.classList.remove('scale-0'); 
                        void slot.offsetWidth; 
                        slot.classList.add('animate-pop'); 
                        slot.style.transform = 'scale(0)';
                        setTimeout(() => slot.style.transform = 'scale(1)', 10);
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

    // [추가된 로직] 만약 선택된 인덱스에 주사위가 없어졌다면(결합되어 사라짐 등) 선택 해제
    if (selectedGridIndex !== null) {
        // serverGridData[selectedGridIndex]가 null이면 주사위가 없는 것
        if (!serverGridData[selectedGridIndex]) {
            deselectDice();
        }
    }
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

// ----------------------------------------------------------------------
// [수정] 캔버스 렌더링 루프
// ----------------------------------------------------------------------
function gameLoop() {
    if(!ctx) return;

    // 배경 지우기
    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1f2937"; 
    ctx.fillRect(0, 0, 1080, 1920);

    // 맵 그리기
    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    // [NEW] 몹 그리기
    if (gameState && gameState.mobs) {
        drawMobs(ctx, gameState.mobs);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// [NEW] 몹 렌더링 함수
function drawMobs(ctx, mobs) {
    if (!mobs) return;
    
    mobs.forEach(mob => {
        // 1. 몹 본체 (빨간 원)
        ctx.beginPath();
        ctx.fillStyle = '#ef4444'; // Red-500
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.arc(mob.x, mob.y, 24, 0, Math.PI * 2); // 반지름 24px
        ctx.fill();
        ctx.shadowBlur = 0; // 쉐도우 초기화
        
        // 2. 테두리
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // 3. 체력바 (몹 위에 표시)
        const barWidth = 60;
        const barHeight = 8;
        const hpPercent = mob.hp / mob.max_hp;
        
        // 배경 (회색)
        ctx.fillStyle = '#374151'; 
        ctx.fillRect(mob.x - barWidth/2, mob.y - 45, barWidth, barHeight);
        
        // 체력 (초록색)
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(mob.x - barWidth/2, mob.y - 45, barWidth * hpPercent, barHeight);
        
        // 체력바 테두리
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(mob.x - barWidth/2, mob.y - 45, barWidth, barHeight);
    });
}

function drawPath(ctx, path) {
    if(!path || path.length < 2) return;

    // 도로 (회색)
    ctx.beginPath();
    ctx.lineWidth = 100; 
    ctx.strokeStyle = "#374151"; // Gray-700
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
    ctx.strokeStyle = "#4b5563"; // Gray-600
    ctx.setLineDash([20, 20]); 
    
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawGrid(ctx, grid) {
    if(!grid) return;
    
    // 그리드 영역 표시
    ctx.lineWidth = 4; 
    grid.forEach((cell) => {
        ctx.fillStyle = "#374151"; // Gray-700
        ctx.strokeStyle = "#4b5563"; // Gray-600
        
        const r = 24; 
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
        
        // 버튼 클릭 효과
        const btn = document.querySelector('button[onclick="window.spawnDice()"]');
        if(btn) {
            btn.classList.add('scale-95');
            setTimeout(() => btn.classList.remove('scale-95'), 100);
        }
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

// 그리드 슬롯 클릭
function onGridSlotClick(idx) {
    console.log("Grid Clicked:", idx);
    // TODO: 머지 로직 구현 시 사용
}

// ----------------------------------------------------------------------
// 7. 유틸리티
// ----------------------------------------------------------------------
function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}