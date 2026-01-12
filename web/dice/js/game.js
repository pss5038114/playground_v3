// web/dice/js/game.js

function initGameCanvas() { 
    canvas = document.getElementById('game-canvas'); 
    if(canvas) { 
        ctx = canvas.getContext('2d'); 
        requestAnimationFrame(renderLoop); 
    } 
}

function startGame(mode) { 
    // 나중에 게임 시작 로직 구현
}

function renderLoop() { 
    if(!ctx) return; 
    ctx.clearRect(0,0,canvas.width,canvas.height); 
    ctx.strokeStyle='#475569'; ctx.lineWidth=1; 
    const s=canvas.width/5; 
    for(let x=0;x<5;x++) for(let y=0;y<3;y++) ctx.strokeRect(x*s,(canvas.height-s*3)/2+y*s,s,s); 
    requestAnimationFrame(renderLoop); 
}

function spawnDice() { 
    if(socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "SPAWN" }));
}