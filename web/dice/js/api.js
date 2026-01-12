// web/dice/js/api.js

async function fetchMyResources() {
    try {
        const res = await fetch(`${API_AUTH}/profile/${myId}`);
        if(res.ok) {
            const data = await res.json();
            document.getElementById('res-gem').innerText = data.gems.toLocaleString();
            document.getElementById('res-gold').innerText = data.gold.toLocaleString();
            document.getElementById('res-ticket').innerText = data.tickets.toLocaleString();
        }
    } catch(e) {}
}

async function addResource(type, amount) {
    await fetch(`${API_AUTH}/add-resource`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:myId,type:type,amount:amount})});
    alert("지급 완료!"); fetchMyResources();
}

async function summonDice(count) {
    try {
        const res = await fetch(`${API_DICE}/summon`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: myId, count: count})
        });
        const data = await res.json();
        
        if(!res.ok) {
            alert(data.detail || "오류");
            return null;
        }
        // [수정] 성공 시 데이터 반환만 함 (UI 처리는 ui.js에서)
        return data; 
        
    } catch(e) { 
        alert("서버 통신 오류");
        return null;
    }
}

async function fetchMyDice() {
    try {
        const res = await fetch(`${API_DICE}/list/${myId}`);
        if(res.ok) {
            currentDiceList = await res.json();
            // ui.js에 있는 함수 호출
            if(typeof renderDiceGrid === 'function') renderDiceGrid(currentDiceList);
        }
    } catch(e){}
}

async function upgradeDice(diceId) {
    try {
        const res = await fetch(`${API_DICE}/upgrade`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username: myId, dice_id: diceId }) });
        const data = await res.json();
        if(res.ok) {
            const btn = document.getElementById('popup-action-btn');
            if(btn) {
                btn.classList.add('burst-effect');
                setTimeout(() => btn.classList.remove('burst-effect'), 600);
            }
            await fetchMyResources();
            // 리스트 갱신 후 팝업 업데이트
            const listRes = await fetch(`${API_DICE}/list/${myId}`);
            if(listRes.ok) {
                currentDiceList = await listRes.json();
                renderDiceGrid(currentDiceList);
                
                const updatedDice = currentDiceList.find(d => d.id === diceId);
                if(updatedDice) {
                    currentSelectedDice = updatedDice;
                    const classEl = document.getElementById('popup-dice-class');
                    if(classEl) classEl.innerText = `Lv.${updatedDice.class_level}`;
                    showDiceDetail(diceId); // 팝업 리프레시
                }
            }
        } else { alert(data.detail || "오류"); }
    } catch(e) { alert("통신 오류"); }
}