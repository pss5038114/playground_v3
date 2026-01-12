// web/dice/js/state.js
const API_AUTH = "https://api.pyosh.cloud/api/auth";
const API_DICE = "https://api.pyosh.cloud/api/dice";
const myId = sessionStorage.getItem('username');

// 전역 상태 관리
let currentDiceList = [];
let currentSelectedDice = null;
let currentViewMode = null; // 'class' | 'power' | null

// 게임 관련 전역 변수
let socket = null;
let canvas, ctx;