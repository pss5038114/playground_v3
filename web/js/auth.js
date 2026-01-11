const API = "https://api.pyosh.cloud/api/auth";

// 상태 변수 (중복 확인 통과 여부)
let isIdChecked = false;
let isNickChecked = false;

// 입력값 변경 시 중복확인 초기화
function resetCheck(type) {
    if(type === 'id') {
        isIdChecked = false;
        const btn = document.getElementById('btn-check-id');
        btn.innerText = "중복확인";
        btn.classList.remove('checked');
    } else if(type === 'nick') {
        isNickChecked = false;
        const btn = document.getElementById('btn-check-nick');
        btn.innerText = "중복확인";
        btn.classList.remove('checked');
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

    // 1. 유효성 검사
    if(!username || !password || !pwConfirm || !birthdate || !nickname) {
        return alert("모든 정보를 입력해주세요.");
    }
    
    // 2. 비밀번호 일치 확인
    if(password !== pwConfirm) {
        return alert("비밀번호가 일치하지 않습니다.");
    }

    // 3. 중복 확인 여부 체크
    if(!isIdChecked) return alert("아이디 중복 확인을 해주세요.");
    if(!isNickChecked) return alert("닉네임 중복 확인을 해주세요.");

    // 4. 생일 형식 체크 (간단)
    if(birthdate.length !== 4) return alert("생일은 4자리 숫자(MMDD)로 입력해주세요.");

    const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname, birthdate })
    });

    if(res.ok) { 
        alert("가입 신청 완료!\n관리자 승인 후 이용 가능합니다."); 
        location.href='login.html'; 
    }
    else alert((await res.json()).detail);
}

// 로그인 요청 (기존 유지)
async function handleLogin() {
    const username = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;
    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if(res.ok) { 
        sessionStorage.setItem('nickname', data.nickname); 
        sessionStorage.setItem('username', data.username);
        location.href='home.html'; 
    }
    else alert(data.detail);
}

// 비밀번호 초기화 요청 (생일 추가)
async function handleReset() {
    const username = document.getElementById('reset-id').value;
    const birthdate = document.getElementById('reset-birth').value;
    const password = document.getElementById('reset-pw').value;
    
    if(!username || !birthdate || !password) return alert("모든 정보를 입력해주세요.");

    const res = await fetch(`${API}/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, birthdate })
    });
    
    if(res.ok) { 
        alert("비밀번호 변경 요청 완료!\n관리자 승인을 기다려주세요."); 
        location.href='login.html'; 
    }
    else alert((await res.json()).detail);
}