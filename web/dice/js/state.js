// web/dice/js/state.js

const API_AUTH = "https://api.pyosh.cloud/api/auth";
const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// 전역 상태 관리
let currentDiceList = [];
let currentSelectedDice = null;
let currentViewMode = null; 

// [덱 관리 상태]
let myDecks = {}; // { 1: {name: "Preset 1", slots: [...]}, ... }
let currentPresetIndex = 1; // 1~7
// 호환성을 위해 myDeck은 현재 선택된 덱의 slots를 가리키도록 getter를 쓰거나 동기화해야 함
// 여기서는 동기화 방식으로 사용
let myDeck = ['fire', 'electric', 'wind', 'ice', 'poison']; 
let selectedDeckSlot = -1; 

// 게임 관련 전역 변수
let socket = null;
let canvas, ctx;