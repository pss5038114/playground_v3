// web/dice/js/state.js

const API_AUTH = "https://api.pyosh.cloud/api/auth";
const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// 전역 상태 관리
let currentDiceList = [];
let currentSelectedDice = null;
let currentViewMode = null; 

// [NEW] 덱 관리 상태
// 초기 덱 설정 (빈 슬롯 방지)
let myDeck = ['fire', 'electric', 'wind', 'ice', 'poison']; 
let selectedDeckSlot = -1; // -1: 선택 안됨, 0~4: 해당 슬롯 선택됨

// 게임 관련 전역 변수
let socket = null;
let canvas, ctx;