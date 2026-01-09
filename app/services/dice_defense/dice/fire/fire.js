export const FireVisual = {
    color: "#ff4d4d",
    draw(ctx, x, y, rank) {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(x+50, y+50, 40, 0, Math.PI*2); ctx.fill();
        // 눈금 그리기 로직...
        ctx.fillStyle = "white";
        if(rank === 1) { ctx.beginPath(); ctx.arc(x+50, y+50, 6, 0, Math.PI*2); ctx.fill(); }
        // ... (간소화)
    }
};