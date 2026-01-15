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

// [수정] 데이터를 리턴하도록 변경하여 ui.js에서 await로 기다릴 수 있게 함
async function fetchMyDice() {
    try {
        const res = await fetch(`${API_DICE}/list/${myId}`);
        if(res.ok) {
            const list = await res.json();
            currentDiceList = list; // 전역 변수 업데이트
            
            // UI 렌더링 함수가 있다면 호출
            if(typeof renderDiceGrid === 'function') renderDiceGrid(currentDiceList);
            
            return list; // 데이터 리턴 추가
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
            // 리스트 갱신 후 팝업 업데이트
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

// [NEW] 내 덱 불러오기
async function fetchMyDeck() {
    try {
        const res = await fetch(`${API_DICE}/deck/${myId}`);
        if(res.ok) {
            const data = await res.json();
            // data.deck은 [{id:..., name:...}, null, ...] 형태
            myDeck = data.deck;
            if(typeof renderDeckSlots === 'function') renderDeckSlots();
        }
    } catch(e) { console.error(e); }
}

// [NEW] 덱 저장하기
async function saveMyDeck() {
    try {
        // null은 "none"으로 변환하여 전송
        const deckIds = myDeck.map(d => d ? d.id : "none");
        await fetch(`${API_DICE}/deck`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: myId, deck: deckIds })
        });
        // 저장 후 다시 불러와서 싱크 맞춤 (선택)
        // fetchMyDeck(); 
    } catch(e) { alert("덱 저장 실패"); }
}