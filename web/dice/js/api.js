// web/dice/js/api.js

async function fetchMyResources() {
    try {
        const res = await fetch(`${API_AUTH}/profile/${myId}`);
        if(res.ok) {
            const data = await res.json();
            const gemEl = document.getElementById('res-gem');
            const goldEl = document.getElementById('res-gold');
            const ticketEl = document.getElementById('res-ticket');
            
            if(gemEl) gemEl.innerText = data.gems.toLocaleString();
            if(goldEl) goldEl.innerText = data.gold.toLocaleString();
            if(ticketEl) ticketEl.innerText = data.tickets.toLocaleString();
        }
    } catch(e) {}
}

async function addResource(type, amount) {
    await fetch(`${API_AUTH}/add-resource`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:myId,type:type,amount:amount})});
    alert("지급 완료!"); fetchMyResources();
}

async function summonDice(count) {
    try {
        const res = await fetch(`${API_DICE}/summon`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:myId,count:count})});
        const data = await res.json();
        if(!res.ok) {
            alert(data.detail||"오류");
            return null;
        }
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
            const list = await res.json();
            currentDiceList = list;
            if(typeof renderDiceGrid === 'function') renderDiceGrid(currentDiceList);
            return list;
        }
    } catch(e){}
    return [];
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
            await fetchMyDice(); 
            
            const updatedDice = currentDiceList.find(d => d.id === diceId);
            if(updatedDice) {
                currentSelectedDice = updatedDice;
                const classEl = document.getElementById('popup-dice-class');
                if(classEl) classEl.innerText = `Lv.${updatedDice.class_level}`;
                showDiceDetail(diceId); 
            }
        } else { alert(data.detail || "오류"); }
    } catch(e) { alert("통신 오류"); }
}

// [NEW] 덱 정보 가져오기
async function fetchMyDeck() {
    try {
        const res = await fetch(`${API_DICE}/deck/${myId}`);
        if (res.ok) {
            const data = await res.json();
            myDeck = data.deck; // 전역 변수 업데이트
            if (typeof renderDeckSlots === 'function') renderDeckSlots();
            if (typeof renderDiceGrid === 'function' && currentDiceList.length > 0) renderDiceGrid(currentDiceList);
        }
    } catch(e) { console.error("Deck fetch failed", e); }
}

// [NEW] 덱 정보 저장하기
async function saveMyDeck() {
    try {
        await fetch(`${API_DICE}/deck/save`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: myId, deck: myDeck })
        });
    } catch(e) { console.error("Deck save failed", e); }
}