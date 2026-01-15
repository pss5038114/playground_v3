// web/dice/js/state.js
const API_AUTH = "https://api.pyosh.cloud/api/auth";
const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// 전역 상태 관리
let currentDiceList = [];
let currentSelectedDice = null;
let currentViewMode = null; // 'class' | 'power' | null

// [NEW] 덱 관리 상태
let myDeck = [null, null, null, null, null]; // 5개 슬롯 (주사위 ID 또는 객체 저장)
let editingSlotIdx = null; // 현재 편집 중인 슬롯 인덱스 (0~4 or null)

// 게임 관련 전역 변수
let socket = null;
let canvas, ctx;
let isUpgradeJustHappened = false;