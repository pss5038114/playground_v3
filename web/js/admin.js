// 관리자 및 DB 접속용 전역 상태 및 API 경로
const API_BASE = "https://api.pyosh.cloud/api/auth";
const API_MAIL = "https://api.pyosh.cloud/api/mail"; // 메일 API 경로 추가

let currentAdminKey = sessionStorage.getItem('adminKey') || "";
let currentDBKey = sessionStorage.getItem('dbKey') || "";

// 1. 관리자 승인 목록 불러오기 (로그인 역할 겸함)
async function loadAdminRequests() {
    const inputEl = document.getElementById('admin-key-input');
    const key = inputEl ? inputEl.value.trim() : currentAdminKey;
    
    if (!key) { 
        alert("보안 키를 입력해주세요."); 
        return; 
    }

    try {
        const res = await fetch(`${API_BASE}/admin/pending?admin_key=${encodeURIComponent(key)}`);
        
        if (res.ok) {
            currentAdminKey = key;
            sessionStorage.setItem('adminKey', key);
            const users = await res.json();
            
            // UI 전환
            document.getElementById('admin-login-box').classList.add('hidden');
            document.getElementById('pending-list-area').classList.remove('hidden');

            // 승인 대기 목록 렌더링
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

            // [신규] 유저 목록 불러오기 (우편 발송용)
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

// 2. 승인/거절 처리
async function approve(id, action) {
    if (!confirm("정말 처리하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/approve?user_id=${id}&action=${action}&admin_key=${encodeURIComponent(currentAdminKey)}`, { method: 'POST' });
        if(res.ok) {
            alert("완료되었습니다.");
            loadAdminRequests(); 
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

// 4. DB 브라우저 초기화
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

// 5. DB 셀 실시간 수정
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

// [신규] 6. 유저 목록 불러오기 (우편 발송용)
async function loadUserListForMail() {
    if(!currentAdminKey) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users?admin_key=${encodeURIComponent(currentAdminKey)}`);
        if(res.ok) {
            const users = await res.json();
            const select = document.getElementById('mail-receiver');
            if(select) {
                select.innerHTML = '<option value="">-- 유저 선택 --</option>';
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.username;
                    opt.innerText = `${u.nickname} (${u.username})`;
                    select.appendChild(opt);
                });
            }
        }
    } catch(err) {
        console.error("User List Load Error:", err);
    }
}

// [신규] 7. 관리자 우편 발송
async function sendAdminMail() {
    const receiver = document.getElementById('mail-receiver').value;
    const title = document.getElementById('mail-title').value;
    const content = document.getElementById('mail-content').value;
    const scheduledTime = document.getElementById('mail-scheduled').value; // YYYY-MM-DDTHH:MM 형식

    if(!receiver || !title || !content) {
        alert("받는 사람, 제목, 내용을 모두 입력해주세요.");
        return;
    }

    // 날짜 포맷 변환 (HTML input은 'T'가 포함되므로 공백으로 변경하여 DB 저장)
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
                receiver_username: receiver,
                title: title,
                content: content,
                scheduled_at: formattedTime
            })
        });

        if(res.ok) {
            alert("우편이 발송되었습니다!");
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