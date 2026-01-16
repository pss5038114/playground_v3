// web/dice/js/game.js

// 캔버스 및 컨텍스트 가져오기
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ==========================================
// 1. 그리드 상수 정의 (7x4)
// ==========================================
const GRID_W = 7;
const GRID_H = 4;
let CELL_SIZE = 80; // 화면 크기에 따라 반응형으로 조절됨

// 좌표 변환 함수: 논리 좌표(Bottom-Left 0,0) -> 캔버스 좌표(Top-Left 0,0)
function getCanvasCoord(logicX, logicY) {
    // 캔버스 Y = (전체 높이 - 논리 Y) * 셀 크기
    // 예: logicY=0 (바닥) -> canvasY=4*80=320 (바닥)
    // 예: logicY=3.5 (상단) -> canvasY=(4-3.5)*80 = 0.5*80 = 40 (위쪽)
    return {
        x: logicX * CELL_SIZE,
        y: (GRID_H - logicY) * CELL_SIZE
    };
}

// 리사이징 처리
function resizeCanvas() {
    // 화면 꽉 차게 혹은 비율 유지
    const aspect = GRID_W / GRID_H; // 7 / 4 = 1.75
    let w = window.innerWidth;
    let h = w / aspect;
    
    if (h > window.innerHeight * 0.8) {
        h = window.innerHeight * 0.8;
        w = h * aspect;
    }
    
    canvas.width = w;
    canvas.height = h;
    CELL_SIZE = w / GRID_W;
    
    drawBoard(); // 리사이즈 시 다시 그리기
}
window.addEventListener('resize', resizeCanvas);

// ==========================================
// 2. 보드 그리기 (배경 + 그리드 + 경로)
// ==========================================
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // (1) 배경 채우기
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // (2) 주사위 배치 구역 (5x3) 표시
    // x: 1~5, y: 0~2
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    
    for (let x = 1; x <= 5; x++) {
        for (let y = 0; y <= 2; y++) {
            // 사각형 그리기 (Top-Left 기준)
            // 논리좌표 (x, y)가 해당 셀의 바닥-왼쪽이 아니라, 인덱스라고 가정하면:
            // 캔버스에 그릴 때는 y축 반전 주의.
            // y=0인 셀은 캔버스에서 가장 아래쪽 행(index 3)에 위치해야 함.
            // 캔버스 Row Index = GRID_H - 1 - y
            
            const screenX = x * CELL_SIZE;
            const screenY = (GRID_H - 1 - y) * CELL_SIZE; 
            
            // 슬롯 배경
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
            ctx.strokeRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
        }
    }

    // (3) 몬스터 이동 경로 그리기 (U자형)
    // 경로: (0.5, 0) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, 0)
    const pathPoints = [
        {x: 0.5, y: 0.0},
        {x: 0.5, y: 3.5},
        {x: 6.5, y: 3.5},
        {x: 6.5, y: 0.0}
    ];

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = CELL_SIZE * 0.4; // 길 두께
    ctx.strokeStyle = "#4a4"; // 초록색 길

    const start = getCanvasCoord(pathPoints[0].x, pathPoints[0].y);
    ctx.moveTo(start.x, start.y);

    for (let i = 1; i < pathPoints.length; i++) {
        const p = getCanvasCoord(pathPoints[i].x, pathPoints[i].y);
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    
    // (4) 디버그: 좌표 텍스트 (옵션)
    ctx.fillStyle = "white";
    ctx.font = "12px monospace";
    ctx.fillText("Start", start.x - 20, start.y - 10);
    const end = getCanvasCoord(6.5, 0);
    ctx.fillText("End", end.x - 10, end.y - 10);
}

// 초기화
resizeCanvas();