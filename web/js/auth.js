const API = "https://api.pyosh.cloud/api/auth";

async function handleSignup() {
    const username = document.getElementById('sign-id').value;
    const password = document.getElementById('sign-pw').value;
    const nickname = document.getElementById('sign-nick').value;
    const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname })
    });
    if(res.ok) { alert("가입 대기 신청 완료!"); location.href='login.html'; }
    else alert((await res.json()).detail);
}

async function handleLogin() {
    const username = document.getElementById('login-id').value;
    const password = document.getElementById('login-pw').value;
    const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if(res.ok) { sessionStorage.setItem('nickname', data.nickname); location.href='home.html'; }
    else alert(data.detail);
}

async function handleReset() {
    const username = document.getElementById('reset-id').value;
    const password = document.getElementById('reset-pw').value;
    const res = await fetch(`${API}/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if(res.ok) { alert("비번 변경 요청 완료!"); location.href='login.html'; }
    else alert((await res.json()).detail);
}