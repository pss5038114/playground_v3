const API_BASE = "https://api.pyosh.cloud/api/auth";
const API_MAIL = "https://api.pyosh.cloud/api/mail";

let currentAdminKey = sessionStorage.getItem('adminKey') || "";
let currentDBKey = sessionStorage.getItem('dbKey') || "";
let allUsersCache = []; // 유저 목록 캐싱용

// 1. 관리자 승인 목록
async function loadAdminRequests() {
    const inputEl = document.getElementById('admin-key-input');
    const key = inputEl ? inputEl.value.trim() : currentAdminKey;
    
    if (!key) { alert("보안 키를 입력해주세요."); return; }

    try {
        const res = await fetch(`${API_BASE}/admin/pending?admin_key=${encodeURIComponent(key)}`);
        
        if (res.ok) {
            currentAdminKey = key;
            sessionStorage.setItem('adminKey', key);
            const users = await res.json();
            
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

            // 유저 목록 미리 로딩
            loadUserListForMail();

        } else { 
            alert("관리자 보안 키가 올바르지 않습니다."); 
            if(inputEl) inputEl.value = ""; 
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("서버 연결에 실패했습니다.");
    }
}

async function approve(id, action) {
    if (!confirm("정말 처리하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/approve?user_id=${id}&action=${action}&admin_key=${encodeURIComponent(currentAdminKey)}`, { method: 'POST' });
        if(res.ok) { alert("완료되었습니다."); loadAdminRequests(); } 
        else { alert("오류 발생"); }
    } catch (err) { alert("서버 통신 오류"); }
}

function goToDBManager() {
    const dbKeyInput = document.getElementById('db-master-key-input');
    const dbKey = dbKeyInput ? dbKeyInput.value.trim() : "";
    if(!dbKey) { alert("2차 보안 키를 입력하세요."); return; }
    sessionStorage.setItem('dbKey', dbKey);
    location.href = 'db_manager.html';
}

async function openDBManager() {
    if(!currentAdminKey || !currentDBKey) { alert("인증 정보 만료"); location.href='admin.html'; return; }
    try {
        const res = await fetch(`${API_BASE}/admin/db/tables?admin_key=${encodeURIComponent(currentAdminKey)}&db_key=${encodeURIComponent(currentDBKey)}`);
        if (res.ok) { renderDB(await res.json()); } 
        else { alert("인증 실패"); location.href='admin.html'; }
    } catch (err) { alert("오류 발생"); }
}

function renderDB(tables) {
    const area = document.getElementById('db-content-area');
    const links = document.getElementById('table-links');
    if(!area || !links) return;
    area.innerHTML = ""; links.innerHTML = "";
    tables.forEach(t => {
        const btn = document.createElement('button');
        btn.innerText = t.name;
        btn.style.cssText = "width:auto; padding:8px 12px; font-size:12px; background:#ddd; margin:2px; border-radius:5px; cursor:pointer;";
        btn.onclick = () => {
            document.querySelectorAll('.db-table-section').forEach(s => s.style.display = 'none');
            document.getElementById(`section-${t.name}`).style.display = 'block';
        };
        links.appendChild(btn);
        const section = document.createElement('div');
        section.id = `section-${t.name}`;
        section.className = "db-table-section";
        section.style.display = "none";
        let html = `<h4 style="margin-top:20px; color:#1877f2;">[TABLE: ${t.name}]</h4><table class="db-table"><thead><tr>`;
        t.columns.forEach(c => html += `<th>${c}</th>`);
        html += `</tr></thead><tbody>`;
        t.data.forEach(row => {
            html += `<tr>`;
            t.columns.forEach(c => {
                const isId = c === 'id';
                html += `<td><input type="text" value="${row[c] || ''}" ${isId ? 'disabled':''} onblur="updateDBCell('${t.name}', ${row.id}, '${c}', this.value)" style="${isId ? 'background:#f0f0f0;':''}"></td>`;
            });
            html += `</tr>`;
        });
        section.innerHTML = html + "</tbody></table>";
        area.appendChild(section);
    });
    if(tables.length > 0) area.querySelector('.db-table-section').style.display = 'block';
}

async function updateDBCell(tableName, rowId, colName, newValue) {
    await fetch(`${API_BASE}/admin/db/update?admin_key=${encodeURIComponent(currentAdminKey)}&db_key=${encodeURIComponent(currentDBKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: tableName, row_id: rowId, column_name: colName, new_value: newValue })
    });
}

// [신규] 유저 목록 로딩 (캐싱)
async function loadUserListForMail() {
    if(!currentAdminKey) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users?admin_key=${encodeURIComponent(currentAdminKey)}`);
        if(res.ok) {
            allUsersCache = await res.json();
        }
    } catch(err) { console.error(err); }
}

// [신규] 유저 모달 관련 함수들
function openUserModal() {
    const modal = document.getElementById('user-modal');
    if(modal) {
        modal.style.display = 'flex';
        renderUserList(allUsersCache); // 전체 목록 렌더링
    }
}

function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
}

function renderUserList(users) {
    const listEl = document.getElementById('modal-user-list');
    listEl.innerHTML = users.map(u => `
        <div class="user-item" onclick="selectUser('${u.username}', '${u.nickname} (${u.username})')">
            <span>${u.nickname}</span>
            <span style="font-size:12px; color:#888;">${u.username}</span>
        </div>
    `).join('');
}

function filterUsers() {
    const query = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsersCache.filter(u => 
        u.username.toLowerCase().includes(query) || 
        u.nickname.toLowerCase().includes(query)
    );
    renderUserList(filtered);
}

function selectUser(username, displayName) {
    document.getElementById('mail-receiver-val').value = username;
    document.getElementById('mail-receiver-display').value = displayName;
    closeUserModal();
}

// [신규] 우편 발송 (ALL 지원)
async function sendAdminMail() {
    const receiver = document.getElementById('mail-receiver-val').value; // hidden value 사용
    const title = document.getElementById('mail-title').value;
    const content = document.getElementById('mail-content').value;
    const scheduledTime = document.getElementById('mail-scheduled').value;

    if(!receiver || !title || !content) {
        alert("받는 사람, 제목, 내용을 모두 입력해주세요.");
        return;
    }

    let formattedTime = null;
    if(scheduledTime) {
        formattedTime = scheduledTime.replace("T", " ") + ":00";
    }

    try {
        const res = await fetch(`${API_MAIL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: "운영자",
                receiver_username: receiver, // "ALL" 또는 특정 ID
                title: title,
                content: content,
                scheduled_at: formattedTime
            })
        });

        if(res.ok) {
            const data = await res.json();
            alert(data.message); // "전체 ~명에게 발송 완료" 메시지 출력
            // 초기화
            document.getElementById('mail-title').value = "";
            document.getElementById('mail-content').value = "";
            document.getElementById('mail-scheduled').value = "";
        } else {
            alert("발송 실패: " + (await res.json()).detail);
        }
    } catch(err) {
        alert("서버 오류 발생");
    }
}

// 전역 등록
window.loadAdminRequests = loadAdminRequests;
window.approve = approve;
window.goToDBManager = goToDBManager;
window.openDBManager = openDBManager;
window.updateDBCell = updateDBCell;
window.loadUserListForMail = loadUserListForMail;
window.sendAdminMail = sendAdminMail;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.filterUsers = filterUsers;
window.selectUser = selectUser;