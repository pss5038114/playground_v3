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
            myDecks = data.decks; // 전체 덱 데이터 저장
            
            // 현재 선택된 프리셋 데이터 로드
            if (myDecks[currentPresetIndex]) {
                myDeck = myDecks[currentPresetIndex].slots;
            }
            
            if (typeof renderDeckUI === 'function') renderDeckUI();
            if (typeof renderDiceGrid === 'function' && currentDiceList.length > 0) renderDiceGrid(currentDiceList);
        }
    } catch(e) { console.error("Deck fetch failed", e); }
}

// [수정됨] 현재 프리셋 저장하기
async function saveMyDeck() {
    try {
        // 로컬 데이터 최신화
        if (!myDecks[currentPresetIndex]) {
            myDecks[currentPresetIndex] = { name: `Preset ${currentPresetIndex}`, slots: [] };
        }
        myDecks[currentPresetIndex].slots = [...myDeck];

        const payload = { 
            username: myId, 
            preset_index: currentPresetIndex, // 정수 형태 보장
            name: myDecks[currentPresetIndex].name,
            deck: myDeck 
        };

        const res = await fetch(`${API_DICE}/deck/save`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) {
            console.error("덱 저장 실패:", data);
            alert("덱 저장 실패: " + (data.detail || "오류 발생"));
        } else {
            console.log("서버에 덱 저장 완료:", payload);
        }
    } catch(e) { 
        console.error("덱 저장 중 통신 오류:", e);
    }
}

// [NEW] 유저 스탯(크리티컬 등) 가져오기
async function fetchMyStats() {
    try {
        const res = await fetch(`${API_DICE}/stats/${myId}`);
        if (res.ok) {
            const data = await res.json();
            updateStatsUI(data); // UI 업데이트 함수 호출
        }
    } catch(e) { console.error("Stats fetch error", e); }
}