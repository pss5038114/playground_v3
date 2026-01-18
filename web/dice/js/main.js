// web/dice/js/main.js

// [기존 코드 유지: 로그인 체크 및 컴포넌트 로드]
window.onload = function() {
    if(!myId) { 
        location.href = '../index.html'; 
        return; 
    }
    loadComponents();
    
    // 로드 후 초기 프리셋 UI 설정을 위해 잠시 지연 실행 (컴포넌트 로딩 시간 고려)
    setTimeout(() => {
        updatePresetUI(1);
    }, 100);
};

// -------------------------------------------------------------
// [추가된 로직] 프리셋 선택 및 게임 시작 기능
// -------------------------------------------------------------

// 현재 선택된 프리셋 (기본값 1)
let currentSelectedPreset = 1;

// 1. 프리셋 버튼 클릭 시 호출
window.selectLobbyPreset = function(presetIdx) {
    currentSelectedPreset = presetIdx;
    console.log(`Preset ${presetIdx} selected.`);
    
    updatePresetUI(presetIdx);
};

// 2. 전투 시작 버튼 클릭 시 호출
window.startSoloGame = function() {
    console.log(`Starting Solo Game with Preset ${currentSelectedPreset}...`);
    
    // URL에 선택된 프리셋 번호를 붙여서 이동
    window.location.href = `play.html?mode=solo&preset=${currentSelectedPreset}`;
};

// 3. 버튼 스타일 업데이트 (파란색 활성화)
function updatePresetUI(activeIndex) {
    const buttons = document.querySelectorAll('.preset-btn');
    
    buttons.forEach(btn => {
        // onclick 속성에서 숫자 추출 (예: "selectLobbyPreset(2)")
        const onClickText = btn.getAttribute('onclick');
        if (!onClickText) return;
        
        const match = onClickText.match(/\d+/);
        if (!match) return;
        
        const btnIndex = parseInt(match[0]);
        
        if (btnIndex === activeIndex) {
            // 선택됨 (파란색)
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-400');
            btn.classList.remove('bg-slate-800', 'text-slate-500', 'border-transparent');
        } else {
            // 선택 안됨 (어두운 회색)
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-400');
            btn.classList.add('bg-slate-800', 'text-slate-500', 'border-transparent');
        }
    });
}