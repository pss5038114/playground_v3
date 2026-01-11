const API = "/api/auth"; // 상대 경로로 변경하여 로컬/서버 환경 호환

// 상태 변수 (중복 확인 통과 여부)
let isIdChecked = false;
let isNickChecked = false;

// 입력값 변경 시 중복확인 초기화
function resetCheck(type) {
    if(type === 'id') {
        isIdChecked = false;
        const btn = document.getElementById('btn-check-id');
        if(btn) {
            btn.innerText = "중복확인";
            btn.classList.remove('checked');
        }
    } else if(type === 'nick') {
        isNickChecked = false;
        const btn = document.getElementById('btn-check-nick');
        if(btn) {
            btn.innerText = "중복확인";
            btn.classList.remove('checked');
        }
    }
}

// 아이디 중복 확인
async function checkId() {
    const id = document.getElementById('sign-id').value;
    if(!id) return alert("아이디를 입력해주세요.");
    
    try {
        const res = await fetch(`${API}/check-id/${id}`);
        const data = await res.json();
        
        if(data.available) {
            alert(data.message);
            isIdChecked = true;
            const btn = document.getElementById('btn-check-id');
            btn.innerText = "확인완료";
            btn.classList.add('checked');
        } else {
            alert(data.message);
            isIdChecked = false;
        }
    } catch(e) { alert("서버 오류"); }
}

// 닉네임 중복 확인
async function checkNick() {
    const nick = document.getElementById('sign-nick').value;
    if(!nick) return alert("닉네임을 입력해주세요.");
    
    try {
        const res = await fetch(`${API}/check-nick/${nick}`);
        const data = await res.json();
        
        if(data.available) {
            alert(data.message);
            isNickChecked = true;
            const btn = document.getElementById('btn-check-nick');
            btn.innerText = "확인완료";
            btn.classList.add('checked');
        } else {
            alert(data.message);
            isNickChecked = false;
        }
    } catch(e) { alert("서버 오류"); }
}

// 회원가입 요청
async function handleSignup() {
    const username = document.getElementById('sign-id').value;
    const password = document.getElementById('sign-pw').value;
    const pwConfirm = document.getElementById('sign-pw-confirm').value;
    const birthdate = document.getElementById('sign-birth').value;
    const nickname = document.getElementById('sign-nick').value;

    if(!username || !password || !pwConfirm || !birthdate || !nickname) {
        return alert("모든 정보를 입력해주세요.");
    }
    
    if(password !== pwConfirm) {
        return alert("비밀번호가 일치하지 않습니다.");
    }

    if(!isIdChecked) return alert("아이디 중복 확인을 해주세요.");
    if(!isNickChecked) return alert("닉네임 중복 확인을 해주세요.");
    if(birthdate.length !== 4) return alert("생일은 4자리 숫자(MMDD)로 입력해주세요.");

    const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname, birthdate })
    });

    if(res.ok) { 
        alert("가입 신청 완료!\n관리자 승인 후 이용 가능합니다."); 
        location.href='index.html'; 
    }
    else alert((await res.json()).detail);
}

// 로그인 요청
async function handleLogin() {
    const username = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;
    
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if(res.ok) { 
            // dice_game.js와 통일하기 위해 localStorage 사용 및 access_token 저장
            localStorage.setItem('access_token', data.access_token || data.username); 
            localStorage.setItem('nickname', data.nickname); 
            localStorage.setItem('username', data.username);
            location.href='home.html'; 
        } else {
            alert(data.detail);
        }
    } catch(e) {
        alert("로그인 중 오류가 발생했습니다.");
    }
}

// 로그인 상태 체크 함수 (dice_game.js에서 호출)
function checkAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("로그인이 필요합니다.");
        location.href = 'index.html';
        return false;
    }
    return true;
}

// 유저 정보 가져오기 함수 (dice_game.js에서 호출)
function getCurrentUser() {
    return {
        username: localStorage.getItem('username'),
        nickname: localStorage.getItem('nickname')
    };
}

// 전역 스코프에 할당하여 다른 JS 파일 및 HTML에서 접근 가능하게 함
window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.checkId = checkId;
window.checkNick = checkNick;
window.resetCheck = resetCheck;