// web/dice/js/ui_summon.js

// 소환 핸들러
async function handleSummon(count) {
    if (!currentDiceList || currentDiceList.length === 0) {
        await fetchMyDice();
    }

    const data = await summonDice(count);
    if (!data) return;

    if (count === 1) {
        const resultDice = data.results[0];
        let isNew = checkIsNew(resultDice.id);
        
        document.getElementById('single-summon-wrapper').classList.remove('hidden');
        document.getElementById('single-summon-wrapper').classList.add('flex');
        document.getElementById('multi-summon-wrapper').classList.add('hidden');
        document.getElementById('multi-summon-wrapper').classList.remove('flex');
        
        playSingleSummonAnimation(resultDice, isNew);
    } else {
        document.getElementById('single-summon-wrapper').classList.add('hidden');
        document.getElementById('single-summon-wrapper').classList.remove('flex');
        document.getElementById('multi-summon-wrapper').classList.remove('hidden');
        document.getElementById('multi-summon-wrapper').classList.add('flex');
        
        playMultiSummonAnimation(data.results);
    }
}

// 1회 소환 애니메이션
function playSingleSummonAnimation(diceData, isNew) {
    const overlay = document.getElementById('summon-overlay');
    const container = document.getElementById('summon-dice-container');
    const textArea = document.getElementById('summon-text-area');
    const tapArea = document.getElementById('summon-tap-area');
    
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    textArea.classList.add('hidden');
    textArea.classList.remove('text-reveal');
    tapArea.classList.add('hidden');
    
    container.innerHTML = '';
    container.className = "relative w-32 h-32 transition-transform duration-500 cursor-default flex items-center justify-center pointer-events-auto"; 
    container.onclick = null;

    const rarityConfig = getRarityConfig(diceData.rarity);
    
    const hiddenDice = document.createElement('div');
    hiddenDice.className = `w-32 h-32 bg-slate-800 rounded-[22%] flex items-center justify-center shadow-2xl summon-drop relative z-10`;
    hiddenDice.style.boxShadow = `0 0 20px rgba(0,0,0,0.5)`;
    hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-6xl text-white opacity-50"></i>`;
    container.appendChild(hiddenDice);

    setTimeout(() => {
        const flash = document.createElement('div');
        flash.className = 'impact-flash'; 
        container.appendChild(flash);
        
        hiddenDice.style.backgroundColor = 'white';
        hiddenDice.style.border = `4px solid ${rarityConfig.color}`;
        hiddenDice.style.setProperty('--glow-color', rarityConfig.color);
        hiddenDice.classList.remove('summon-drop');
        hiddenDice.classList.add('summon-waiting');
        hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-7xl ${rarityConfig.tailwind}"></i>`;
        
        container.style.cursor = 'pointer';
        container.classList.add('cursor-pointer');
        container.onclick = () => revealDice(hiddenDice, diceData, isNew, rarityConfig);
    }, 600);
}

function revealDice(element, diceData, isNew, config) {
    const container = document.getElementById('summon-dice-container');
    container.onclick = null;
    container.style.cursor = 'default';
    element.classList.remove('summon-waiting');
    
    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    container.appendChild(ripple);
    
    let realIconHtml = renderDiceIcon(diceData, "w-32 h-32");
    realIconHtml = realIconHtml.replace("text-4xl", "text-8xl"); 
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    newDiceEl.classList.add('relative', 'z-10'); 
    
    const glowColor = diceData.color && diceData.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 30px ${glowColor}80`; 
    
    container.replaceChild(newDiceEl, element);
    
    if(isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-4 -right-4 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg border-2 border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "NEW!";
        container.appendChild(badge);
    }

    setTimeout(() => {
        container.classList.add('dice-slide-up');
        const textArea = document.getElementById('summon-text-area');
        const diceName = document.getElementById('summon-dice-name');
        const tapArea = document.getElementById('summon-tap-area'); 
        
        diceName.innerText = diceData.name;
        diceName.style.color = config.color; 
        textArea.classList.remove('hidden');
        textArea.classList.add('text-reveal');
        
        tapArea.classList.remove('hidden');
        tapArea.style.zIndex = "50"; 
        tapArea.onclick = closeSummonOverlay;
    }, 600);
}

// 11회 소환 애니메이션
function playMultiSummonAnimation(results) {
    const overlay = document.getElementById('summon-overlay');
    const gridContainer = document.getElementById('summon-grid-container');
    const skipBtn = document.getElementById('summon-skip-btn');
    const continueMsg = document.getElementById('summon-continue-msg');
    const tapArea = document.getElementById('summon-tap-area');

    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    tapArea.classList.add('hidden'); 
    gridContainer.innerHTML = '';
    skipBtn.classList.remove('hidden');
    continueMsg.classList.add('hidden');

    const rows = [
        results.slice(0, 4), 
        results.slice(4, 7), 
        results.slice(7, 11) 
    ];

    let diceElements = []; 

    rows.forEach((rowDice, rowIndex) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'summon-row';
        
        rowDice.forEach((dice, colIndex) => {
            const isNew = checkIsNew(dice.id);
            const rarityConfig = getRarityConfig(dice.rarity);
            
            const wrapper = document.createElement('div');
            wrapper.className = "relative flex flex-col items-center group";
            
            const box = document.createElement('div');
            box.className = "relative w-20 h-20 bg-transparent flex items-center justify-center cursor-default"; 
            
            const outline = document.createElement('div');
            outline.className = "outline-box";
            const globalIndex = (rowIndex === 0 ? 0 : (rowIndex === 1 ? 4 : 7)) + colIndex;
            outline.style.animationDelay = `${globalIndex * 0.05}s`;
            box.appendChild(outline);

            const hiddenDice = document.createElement('div');
            hiddenDice.className = "absolute inset-0 bg-white rounded-[22%] flex items-center justify-center opacity-0 transform scale-0"; 
            hiddenDice.style.border = `3px solid ${rarityConfig.color}`;
            hiddenDice.style.boxShadow = `0 0 10px ${rarityConfig.color}`;
            hiddenDice.style.setProperty('--glow-color', rarityConfig.color);
            hiddenDice.innerHTML = `<i class="${rarityConfig.icon} text-4xl ${rarityConfig.tailwind}"></i>`;
            
            const appearDelay = 0.6 + (rowIndex * 0.3) + (colIndex * 0.05);
            hiddenDice.style.animation = `pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards ${appearDelay}s, breathe-glow 2s infinite ease-in-out ${appearDelay + 0.4}s`;
            box.appendChild(hiddenDice);
            
            const nameLabel = document.createElement('div');
            nameLabel.className = "absolute -bottom-4 text-[10px] font-bold text-white text-center opacity-0 w-24 truncate pointer-events-none";
            nameLabel.innerText = dice.name;
            
            wrapper.appendChild(box);
            wrapper.appendChild(nameLabel);
            rowEl.appendChild(wrapper);
            
            const diceObj = {
                id: dice.id,
                data: dice,
                isNew: isNew,
                elBox: box,
                elHidden: hiddenDice,
                elName: nameLabel,
                config: rarityConfig,
                isRevealed: false,
                appearTime: (appearDelay + 0.4) * 1000 
            };
            diceElements.push(diceObj);

            box.onclick = () => {
                if (!diceObj.isRevealed && Date.now() > startTime + diceObj.appearTime) {
                    revealMultiSingle(diceObj);
                    checkAllRevealed(diceElements);
                }
            };
        });
        gridContainer.appendChild(rowEl);
    });

    const startTime = Date.now();

    skipBtn.onclick = () => {
        skipBtn.classList.add('hidden'); 
        const unrevealed = diceElements.filter(d => !d.isRevealed);
        unrevealed.forEach((d, i) => {
            setTimeout(() => {
                revealMultiSingle(d);
                if (i === unrevealed.length - 1) checkAllRevealed(diceElements);
            }, i * 100); 
        });
    };
}

function revealMultiSingle(diceObj) {
    if (diceObj.isRevealed) return;
    diceObj.isRevealed = true;

    const { elBox, elHidden, elName, data, isNew, config } = diceObj;

    elBox.style.cursor = 'default';
    elHidden.classList.remove('summon-waiting'); 
    elHidden.style.animation = 'none';
    elHidden.style.opacity = '1';
    elHidden.style.transform = 'scale(1)';

    const ripple = document.createElement('div');
    ripple.className = 'ripple-effect';
    ripple.style.setProperty('--glow-color', config.color);
    elBox.appendChild(ripple);

    let realIconHtml = renderDiceIcon(data, "w-20 h-20");
    realIconHtml = realIconHtml.replace("text-4xl", "text-5xl"); 
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = realIconHtml;
    const newDiceEl = tempDiv.firstElementChild;
    newDiceEl.classList.add('relative', 'z-10');
    
    const glowColor = data.color && data.color.includes('gradient') ? '#ffffff' : config.color;
    newDiceEl.style.boxShadow = `0 0 15px ${glowColor}80`; 

    elBox.replaceChild(newDiceEl, elHidden);

    if (isNew) {
        const badge = document.createElement('div');
        badge.className = 'absolute -top-3 -right-3 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-white new-badge-pop z-20 pointer-events-none';
        badge.innerText = "N";
        elBox.appendChild(badge);
    }

    elName.classList.add('name-fade-in');
}

function checkAllRevealed(diceElements) {
    const allDone = diceElements.every(d => d.isRevealed);
    if (allDone) {
        const skipBtn = document.getElementById('summon-skip-btn');
        const continueMsg = document.getElementById('summon-continue-msg');
        const tapArea = document.getElementById('summon-tap-area');

        if(skipBtn) skipBtn.classList.add('hidden');
        if(continueMsg) continueMsg.classList.remove('hidden');
        
        if(tapArea) {
            tapArea.classList.remove('hidden');
            tapArea.style.zIndex = "50"; 
            tapArea.onclick = closeSummonOverlay;
        }
    }
}