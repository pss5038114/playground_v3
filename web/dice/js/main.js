// web/dice/js/main.js

// [로비 상태] 현재 선택된 덱 프리셋 (기본값 1)
let currentLobbyPreset = 1;

// 1. 프리셋 선택 함수 (버튼 클릭 시 호출)
window.selectLobbyPreset = function(index) {
    currentLobbyPreset = index;
    console.log(`Lobby: Preset ${index} selected.`);
    
    // UI 업데이트 (버튼 스타일 변경)
    updatePresetButtonsUI(index);
};

// 2. UI 업데이트 헬퍼 함수
function updatePresetButtonsUI(selectedIndex) {
    // 1~5번 버튼을 순회하며 스타일 갱신
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`preset-btn-${i}`);
        if (!btn) continue;

        if (i === selectedIndex) {
            // 선택됨: 파란색, 밝은 글씨, 테두리 강조
            btn.className = "w-10 h-10 rounded-lg font-bold text-lg transition-all bg-blue-600 text-white shadow-lg ring-2 ring-blue-400 scale-110";
        } else {
            // 선택 안됨: 어두운 배경, 회색 글씨
            btn.className = "w-10 h-10 rounded-lg font-bold text-lg transition-all bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white";
        }
    }
}

// 3. 게임 시작 함수 (Start 버튼 클릭 시 호출)
window.startSoloGame = function() {
    console.log(`Starting Solo Game with Preset ${currentLobbyPreset}...`);
    // [핵심] 선택된 preset 번호를 URL 파라미터로 전달
    window.location.href = `play.html?mode=solo&preset=${currentLobbyPreset}`;
};

// 페이지 로드 시 초기화 (1번 선택 상태로 시작)
document.addEventListener('DOMContentLoaded', () => {
    // 현재 페이지가 로비라면 UI 초기화
    if (document.getElementById('preset-btn-1')) {
        updatePresetButtonsUI(currentLobbyPreset);
    }
});