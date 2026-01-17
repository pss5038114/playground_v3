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

// ----------------------------------------------------------------------
// [수정] 주사위 레이어 초기화
// ----------------------------------------------------------------------
function initDiceLayer() {
    const container = document.getElementById('game-container');
    let layer = document.getElementById('dice-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'dice-layer';
        layer.className = 'absolute inset-0 pointer-events-none'; 
        container.appendChild(layer);
    }
    layer.innerHTML = ''; 
    
    if (gameMap && gameMap.grid) {
        gameMap.grid.forEach((cell, idx) => {
            const slot = document.createElement('div');
            slot.id = `grid-slot-${idx}`;
            // pointer-events-auto 추가하여 클릭 가능하게 함
            slot.className = 'absolute flex items-center justify-center transition-all duration-200 pointer-events-auto cursor-pointer rounded-full';
            
            updateSlotPosition(slot, cell);
            
            // 클릭 이벤트 연결
            slot.onclick = (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                onGridSlotClick(idx);
            };
            
            layer.appendChild(slot);
        });
    }
}

// ----------------------------------------------------------------------
// [수정] 그리드 슬롯 클릭 핸들러 (로직 강화)
// ----------------------------------------------------------------------
function onGridSlotClick(idx) {
    if (!gameState || !gameState.grid) return;
    
    const clickedDice = gameState.grid[idx];
    console.log(`Grid Clicked: ${idx}`, clickedDice); // 디버깅 로그

    // 1. 이미 선택된 주사위가 있는 경우 (결합 시도 또는 선택 변경)
    if (selectedGridIndex !== null) {
        const sourceIdx = selectedGridIndex;
        const sourceDice = gameState.grid[sourceIdx];

        // 1-1. 같은 주사위를 다시 클릭 -> 선택 해제
        if (sourceIdx === idx) {
            deselectDice();
            return;
        }

        // 1-2. 결합 시도 (소스와 타겟이 모두 존재하고, ID와 레벨이 같은지 체크)
        // 주의: 실제 결합 가능 여부는 서버가 판단하지만, UI 반응을 위해 1차 체크
        if (sourceDice && clickedDice &&
            sourceDice.id === clickedDice.id &&
            sourceDice.level === clickedDice.level) {
            
            console.log(`>>> Sending MERGE Request: ${sourceIdx} -> ${idx}`);
            
            // 웹소켓으로 결합 요청 전송
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ 
                    type: "MERGE", 
                    source_index: sourceIdx, 
                    target_index: idx 
                }));
            }
            
            // 즉시 선택 해제 (결과는 서버 메시지로 옴)
            deselectDice();
            return;
        }

        // 1-3. 결합 불가능한 다른 주사위 클릭 -> 선택 대상 변경
        if (clickedDice) {
            selectDice(idx);
        } else {
            // 빈 땅 클릭 -> 선택 해제
            deselectDice();
        }
    } 
    // 2. 아무것도 선택되지 않은 상태 -> 새로운 선택
    else {
        if (clickedDice) {
            selectDice(idx);
        }
    }
}

// [수정] 주사위 선택 (하이라이트)
function selectDice(idx) {
    // 기존 선택 해제
    deselectDice();
    
    selectedGridIndex = idx;
    const slot = document.getElementById(`grid-slot-${idx}`);
    
    if (slot) {
        // 선택된 주사위 강조 (파란색 링)
        slot.classList.add('ring-4', 'ring-blue-500', 'z-30', 'scale-110');
    }
    
    // 결합 가능한 대상 찾아서 표시
    highlightMergeableTargets(idx);
}

// [수정] 선택 해제
function deselectDice() {
    if (selectedGridIndex !== null) {
        const slot = document.getElementById(`grid-slot-${selectedGridIndex}`);
        if (slot) {
            slot.classList.remove('ring-4', 'ring-blue-500', 'z-30', 'scale-110');
        }
    }
    selectedGridIndex = null;
    clearHighlights();
}

// [수정] 결합 가능 대상 하이라이트
function highlightMergeableTargets(sourceIdx) {
    const sourceDice = gameState.grid[sourceIdx];
    if (!sourceDice) return;
    
    gameState.grid.forEach((targetDice, idx) => {
        if (idx === sourceIdx) return; // 자기 자신 제외
        
        // 결합 조건: 존재함 && ID 같음 && 레벨 같음
        if (targetDice && 
            targetDice.id === sourceDice.id && 
            targetDice.level === sourceDice.level) {
            
            const targetSlot = document.getElementById(`grid-slot-${idx}`);
            if (targetSlot) {
                // 타겟 강조 (빨간색 링 + 펄스)
                targetSlot.classList.add('ring-4', 'ring-red-500', 'z-20', 'animate-pulse', 'cursor-pointer');
            }
        }
    });
}

// [수정] 하이라이트 제거
function clearHighlights() {
    const slots = document.querySelectorAll('[id^="grid-slot-"]');
    slots.forEach(slot => {
        slot.classList.remove('ring-4', 'ring-red-500', 'z-20', 'animate-pulse', 'cursor-pointer');
    });
}

// ----------------------------------------------------------------------
// [수정] 그리드 상태 동기화 (필드 주사위)
// ----------------------------------------------------------------------
// [수정] 그리드 동기화 함수에 선택 상태 유지 로직 포함
function syncGrid(serverGridData) {
    if (!serverGridData) return;

    const scale = canvas ? (canvas.clientWidth / 1080) : 1;

    serverGridData.forEach((diceData, idx) => {
        const slot = document.getElementById(`grid-slot-${idx}`);
        if (!slot) return;

        const currentId = slot.dataset.diceId;
        const currentLevel = slot.dataset.diceLevel;

        if (diceData) {
            if (currentId !== diceData.id || currentLevel != diceData.level) {
                const diceInfo = deckInfoMap[diceData.id];
                if (diceInfo) {
                    // 크기 계산 및 렌더링
                    let realSizePx = 80; 
                    if (gameMap && gameMap.grid && gameMap.grid[idx]) {
                        realSizePx = gameMap.grid[idx].w * scale;
                    }

                    const html = renderDiceIcon(diceInfo, "w-full h-full", diceData.level, realSizePx);
                    slot.innerHTML = html;
                    slot.dataset.diceId = diceData.id;
                    slot.dataset.diceLevel = diceData.level;
                    
                    // 생성 애니메이션
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
            if (currentId) {
                slot.innerHTML = '';
                delete slot.dataset.diceId;
                delete slot.dataset.diceLevel;
            }
        }
    });

    // 선택된 주사위가 사라졌다면(결합됨) 선택 해제
    if (selectedGridIndex !== null) {
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

    ctx.clearRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#1f2937"; 
    ctx.fillRect(0, 0, 1080, 1920);

    if(gameMap) {
        drawPath(ctx, gameMap.path);
        drawGrid(ctx, gameMap.grid);
    }
    
    // 1. 타게팅 라인 그리기 (주사위 -> 몹)
    if (gameState && gameState.grid) {
        drawTargetLines(ctx, gameState.grid, gameState.entities);
    }

    // 2. 엔티티 그리기
    if (gameState && gameState.entities) {
        drawEntities(ctx, gameState.entities);
    }
    
    // 3. [NEW] 투사체 그리기
    if (gameState && gameState.projectiles) {
        drawProjectiles(ctx, gameState.projectiles);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

// [NEW] 타게팅 라인 (레이저)
function drawTargetLines(ctx, grid, entities) {
    if (!grid || !entities) return;
    
    // 엔티티 ID로 빠르게 찾기 위해 맵 생성
    const entityMap = {};
    entities.forEach(e => entityMap[e.id] = e);
    
    // 그리드 픽셀 크기 비율 (1080p -> 실제화면)
    const scale = canvas.clientWidth / 1080; 

    grid.forEach((diceData, idx) => {
        // diceData는 서버의 cell['dice'] (id, level, target_id 등 포함)
        // 하지만 gameMap.grid[idx]에 좌표(cx, cy)가 있음
        if (diceData && diceData.target_id) {
            const target = entityMap[diceData.target_id];
            if (target) {
                const startX = gameMap.grid[idx].cx;
                const startY = gameMap.grid[idx].cy;
                
                ctx.beginPath();
                ctx.lineWidth = 2; // 적당한 두께
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; // Red-500, 반투명
                ctx.moveTo(startX, startY);
                ctx.lineTo(target.x, target.y);
                ctx.stroke();
                
                // 타겟 위에 작은 표적 표시 (선택사항)
                ctx.beginPath();
                ctx.arc(target.x, target.y, 5, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.fill();
            }
        }
    });
}

// [NEW] 투사체 렌더링
function drawProjectiles(ctx, projectiles) {
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = '#facc15'; // Yellow-400 (기본 탄환)
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // 꼬리 효과 (Trail) - 간단하게
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
        // 속도 반대 방향으로 짧은 선
        // (정확한 방향을 모르니 생략하거나, 이전 위치를 저장해야 함. 지금은 원만 그리기)
    });
}

// [NEW] 엔티티 렌더링 함수
function drawEntities(ctx, entities) {
    if (!entities) return;
    
    entities.forEach(entity => {
        // --- 1. 히트박스 (Hitbox) ---
        // 실제 피격 판정 범위 (디버깅용 노란 실선)
        if (entity.hitbox_radius) {
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#facc15'; // Yellow-400
            ctx.setLineDash([5, 5]); // 점선
            ctx.arc(entity.x, entity.y, entity.hitbox_radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]); // 점선 초기화
        }

        // --- 2. 본체 (Visual Body) ---
        ctx.beginPath();
        // 타입별 색상 분기 가능
        ctx.fillStyle = entity.type === 'normal_mob' ? '#ef4444' : '#64748b'; 
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        
        // 서버에서 보내준 radius 사용
        const visualRadius = entity.radius || 20;
        ctx.arc(entity.x, entity.y, visualRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // 테두리
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // --- 3. 체력바 ---
        const barWidth = visualRadius * 2.5;
        const barHeight = 8;
        const hpPercent = entity.hp / entity.max_hp;
        
        const barX = entity.x - barWidth / 2;
        const barY = entity.y - visualRadius - 15;

        // 배경
        ctx.fillStyle = '#374151'; 
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 체력
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // 체력바 테두리
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(barX, barY, barWidth, barHeight);
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

// ----------------------------------------------------------------------
// 7. 유틸리티
// ----------------------------------------------------------------------
function sleep(ms) { 
    return new Promise(r => setTimeout(r, ms)); 
}