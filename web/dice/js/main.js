// web/dice/js/main.js

// [상태 변수] 현재 선택된 프리셋 번호 (기본값 1)
let currentSelectedPreset = 1;

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    console.log("Main Lobby Script Loaded.");
    
    // 초기 프리셋 버튼 UI 설정 (1번 활성화)
    updatePresetUI(1);
});

// ---------------------------------------------------------
// [기능 1] 로비 프리셋 선택 버튼 클릭 시 호출
// HTML에서: onclick="selectLobbyPreset(1)" 형태로 사용
// ---------------------------------------------------------
window.selectLobbyPreset = function(presetIdx) {
    currentSelectedPreset = presetIdx;
    console.log(`Preset ${presetIdx} selected.`);
    
    // UI 업데이트 (버튼 하이라이트 등)
    updatePresetUI(presetIdx);
    
    // (선택 사항) 프리셋 변경 시 덱 미리보기를 갱신하는 함수가 있다면 호출
    // if (window.renderDeckPreview) window.renderDeckPreview(presetIdx);
};

// ---------------------------------------------------------
// [기능 2] 전투 시작 (Solo Mode)
// HTML에서: onclick="startSoloGame()" 형태로 사용
// ---------------------------------------------------------
window.startSoloGame = function() {
    console.log(`Starting Solo Game with Preset ${currentSelectedPreset}...`);
    
    // [핵심 수정] URL에 preset 파라미터를 포함하여 이동
    // game.js가 이 값을 읽어서 해당 덱으로 게임을 초기화함
    window.location.href = `play.html?mode=solo&preset=${currentSelectedPreset}`;
};

// ---------------------------------------------------------
// [UI] 프리셋 버튼 스타일 업데이트
// ---------------------------------------------------------
function updatePresetUI(activeIndex) {
    // 'preset-btn' 클래스를 가진 모든 요소를 찾음 (HTML에 class="preset-btn" 추가 필요)
    const buttons = document.querySelectorAll('.preset-btn');
    
    buttons.forEach(btn => {
        // 버튼의 data-index 속성이나 텍스트를 통해 인덱스 확인
        // (HTML 버튼에 onclick="selectLobbyPreset(N)"이 되어 있다고 가정)
        const btnIndex = parseInt(btn.getAttribute('onclick').match(/\d+/)[0]);
        
        if (btnIndex === activeIndex) {
            // 선택된 상태 스타일 (파란색, 진하게)
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-400');
            btn.classList.remove('bg-slate-700', 'text-slate-400', 'border-transparent');
        } else {
            // 비활성 상태 스타일 (회색)
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-400');
            btn.classList.add('bg-slate-700', 'text-slate-400', 'border-transparent');
        }
    });
}

// ---------------------------------------------------------
// [기타] 탭 전환 등 기존 로비 기능 유지
// ---------------------------------------------------------
window.switchTab = function(tabName) {
    const tabs = ['home', 'deck', 'shop', 'clan', 'event'];
    
    tabs.forEach(t => {
        const content = document.getElementById(`tab-${t}`);
        const btn = document.getElementById(`btn-${t}`);
        
        if (t === tabName) {
            if(content) content.classList.remove('hidden');
            if(btn) btn.classList.add('text-blue-400');
        } else {
            if(content) content.classList.add('hidden');
            if(btn) btn.classList.remove('text-blue-400');
        }
    });
};