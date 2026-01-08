// 관리자 및 DB 접속용 전역 상태 및 API 경로
const API_BASE = "https://api.pyosh.cloud/api/auth";
let currentAdminKey = sessionStorage.getItem('adminKey') || "";
let currentDBKey = sessionStorage.getItem('dbKey') || "";

// 1. 관리자 승인 목록 불러오기 (보안 키 인식 문제 해결)
async function loadAdminRequests() {
    const inputEl = document.getElementById('admin-key-input');
    // 입력창이 있으면 그 값을 우선적으로 가져오고, 없으면 기존 세션 키 사용
    const key = inputEl ? inputEl.value.trim() : currentAdminKey;
    
    console.log("Admin Key Attempt:", key); // 브라우저 콘솔에서 확인 가능

    if (!key) { 
        alert("보안 키를 입력해주세요."); 
        return; 
    }

    try {
        const res = await fetch(`${API_BASE}/admin/pending?admin_key=${encodeURIComponent(key)}`);
        
        if (res.ok) {
            currentAdminKey = key;
            sessionStorage.setItem('adminKey', key); // 세션에 저장하여 페이지 새로고침 시 유지
            const users = await res.json();
            
            // UI 전환: 로그인 박스 숨기고 목록 표시
            document.getElementById('admin-login-box').classList.add('hidden');
            document.getElementById('pending-list-area').classList.remove('hidden');

            const tbody = document.getElementById('admin-user-list');
            tbody.innerHTML = users.length ? "" : "<tr><td colspan='4' style='padding:20px; color:gray;'>대기 중인 요청이 없습니다.</td></tr>";
            
            const map = { 'pending_signup': '회원가입요청', 'pending_reset': '비번변경요청' };
            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${u.username}</td><td>${u.nickname}</td>
                    <td class="type-${u.status}">${map[u.status]}</td>
                    <td>
                        <button class="btn-small approve" onclick="approve(${u.id}, 'approve')">승인</button>
                        <button class="btn-small reject" onclick="approve(${u.id}, 'reject')">거절</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else { 
            alert("관리자 보안 키가 올바르지 않습니다."); 
            if(inputEl) inputEl.value = ""; // 틀렸을 경우 입력창 초기화
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("서버 연결에 실패했습니다.");
    }
}

// 2. 승인/거절 처리 함수
async function approve(id, action) {
    if (!confirm("정말 처리하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/approve?user_id=${id}&action=${action}&admin_key=${encodeURIComponent(currentAdminKey)}`, { method: 'POST' });
        if(res.ok) {
            alert("완료되었습니다.");
            loadAdminRequests(); // 목록 새로고침
        } else {
            alert("처리 중 오류가 발생했습니다.");
        }
    } catch (err) {
        alert("서버 통신 오류");
    }
}

// 3. 2차 보안 키 입력 후 DB 매니저 진입
function goToDBManager() {
    const dbKeyInput = document.getElementById('db-master-key-input');
    const dbKey = dbKeyInput ? dbKeyInput.value.trim() : "";
    
    if(!dbKey) {
        alert("2차 보안 키를 입력하세요.");
        return;
    }
    
    sessionStorage.setItem('dbKey', dbKey);
    location.href = 'db_manager.html';
}

// 4. DB 브라우저 초기화 (db_manager.html 로드 시 실행)
async function openDBManager() {
    if(!currentAdminKey || !currentDBKey) {
        alert("인증 정보가 만료되었습니다. 다시 로그인해주세요.");
        location.href='admin.html';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/admin/db/tables?admin_key=${encodeURIComponent(currentAdminKey)}&db_key=${encodeURIComponent(currentDBKey)}`);
        if (res.ok) {
            renderDB(await res.json());
        } else { 
            alert("2차 보안 인증 실패"); 
            location.href='admin.html'; 
        }
    } catch (err) {
        alert("데이터를 가져오는 중 오류가 발생했습니다.");
    }
}

function renderDB(tables) {
    const area = document.getElementById('db-content-area');
    const links = document.getElementById('table-links');
    if(!area || !links) return;
    
    area.innerHTML = ""; 
    links.innerHTML = "";

    tables.forEach(t => {
        // 테이블 선택 버튼
        const btn = document.createElement('button');
        btn.innerText = t.name;
        btn.style.cssText = "width:auto; padding:8px 12px; font-size:12px; background:#ddd; margin:2px; border-radius:5px; cursor:pointer;";
        btn.onclick = () => {
            document.querySelectorAll('.db-table-section').forEach(s => s.style.display = 'none');
            document.getElementById(`section-${t.name}`).style.display = 'block';
        };
        links.appendChild(btn);

        // 테이블 섹션 생성
        const section = document.createElement('div');
        section.id = `section-${t.name}`;
        section.className = "db-table-section";
        section.style.display = "none";
        
        let html = `<h4 style="margin-top:20px; color:#1877f2;">[TABLE: ${t.name}]</h4>
                    <table class="db-table"><thead><tr>`;
        t.columns.forEach(c => html += `<th>${c}</th>`);
        html += `</tr></thead><tbody>`;
        
        t.data.forEach(row => {
            html += `<tr>`;
            t.columns.forEach(c => {
                const isId = c === 'id';
                html += `<td><input type="text" value="${row[c] || ''}" ${isId ? 'disabled':''} 
                            onblur="updateDBCell('${t.name}', ${row.id}, '${c}', this.value)"
                            style="${isId ? 'background:#f0f0f0;':''}"></td>`;
            });
            html += `</tr>`;
        });
        section.innerHTML = html + "</tbody></table>";
        area.appendChild(section);
    });

    if(tables.length > 0) {
        const firstSection = area.querySelector('.db-table-section');
        if(firstSection) firstSection.style.display = 'block';
    }
}

// 5. DB 셀 실시간 수정 로직
async function updateDBCell(tableName, rowId, colName, newValue) {
    try {
        const res = await fetch(`${API_BASE}/admin/db/update?admin_key=${encodeURIComponent(currentAdminKey)}&db_key=${encodeURIComponent(currentDBKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table_name: tableName, row_id: rowId, column_name: colName, new_value: newValue })
        });
        if(res.ok) console.log(`Updated ${tableName} ID ${rowId}: ${colName}=${newValue}`);
    } catch (err) {
        console.error("Update Failed:", err);
    }
}

// 전역 등록 (HTML의 onclick 등에서 인식 가능하도록)
window.loadAdminRequests = loadAdminRequests;
window.approve = approve;
window.goToDBManager = goToDBManager;
window.openDBManager = openDBManager;
window.updateDBCell = updateDBCell;