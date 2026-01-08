// ... (API 상수 등 기존 동일) ...

// 1. 관리자 데이터 로드
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
            
            // [중요] 상태 매핑 테이블 (여기에 pending_deletion이 꼭 있어야 함)
            const map = { 
                'pending_signup': '회원가입요청', 
                'pending_reset': '비번변경요청',
                'pending_deletion': '탈퇴요청' 
            };
            
            users.forEach(u => {
                const tr = document.createElement('tr');
                // 매핑된 텍스트가 없으면 원래 영어 상태값(status)을 보여줌 (undefined 방지)
                const typeText = map[u.status] || u.status;
                
                tr.innerHTML = `
                    <td>${u.username}</td><td>${u.nickname}</td>
                    <td class="type-${u.status}">${typeText}</td>
                    <td>
                        <button class="btn-small approve" onclick="approve(${u.id}, 'approve')">승인</button>
                        <button class="btn-small reject" onclick="approve(${u.id}, 'reject')">거절</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            loadUserListForMail();
        } else { 
            alert("관리자 보안 키가 올바르지 않습니다."); 
            if(inputEl) inputEl.value = ""; 
        }
    } catch (err) { alert("서버 연결에 실패했습니다."); }
}

// ... (이하 나머지 함수들은 이전과 동일하므로 생략하지 않고 전체 파일로 드립니다) ...
const API_BASE = "https://api.pyosh.cloud/api/auth";
const API_MAIL = "https://api.pyosh.cloud/api/mail";

let currentAdminKey = sessionStorage.getItem('adminKey') || "";
let currentDBKey = sessionStorage.getItem('dbKey') || "";
let allUsersCache = [];
let selectedUsers = new Set();

function refreshData() {
    if(!currentAdminKey) return;
    const btn = document.querySelector('.refresh-btn');
    if(btn) btn.style.transform = "rotate(360deg)";
    loadAdminRequests();
    setTimeout(() => { if(btn) btn.style.transform = "none"; }, 500);
}

async function loadUserListForMail() {
    if(!currentAdminKey) return;
    try {
        const res = await fetch(`${API_BASE}/admin/users?admin_key=${encodeURIComponent(currentAdminKey)}`);
        if(res.ok) allUsersCache = await res.json();
    } catch(err) {}
}
function openUserModal() {
    document.getElementById('user-modal').style.display = 'flex';
    selectedUsers.clear();
    document.getElementById('check-all').checked = false;
    renderUserList(allUsersCache);
}
function closeUserModal() { document.getElementById('user-modal').style.display = 'none'; }
function renderUserList(users) {
    const listEl = document.getElementById('modal-user-list');
    listEl.innerHTML = users.map(u => `
        <div class="user-item">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="user-check" value="${u.username}" 
                       onchange="updateSelection('${u.username}', this.checked)"
                       ${selectedUsers.has(u.username) ? 'checked' : ''}
                       style="width:18px; height:18px; margin:0;">
                <div>
                    <span style="font-weight:bold;">${u.nickname}</span>
                    <span style="font-size:12px; color:#888;">(${u.username})</span>
                </div>
            </div>
        </div>
    `).join('');
}
function filterUsers() {
    const query = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsersCache.filter(u => u.username.toLowerCase().includes(query) || u.nickname.toLowerCase().includes(query));
    renderUserList(filtered);
}
function updateSelection(username, isChecked) {
    if(isChecked) selectedUsers.add(username); else selectedUsers.delete(username);
}
function toggleSelectAll() {
    const isChecked = document.getElementById('check-all').checked;
    const query = document.getElementById('user-search').value.toLowerCase();
    const targets = allUsersCache.filter(u => u.username.toLowerCase().includes(query) || u.nickname.toLowerCase().includes(query));
    targets.forEach(u => { if(isChecked) selectedUsers.add(u.username); else selectedUsers.delete(u.username); });
    renderUserList(targets);
}
function confirmUserSelection() {
    const count = selectedUsers.size;
    const display = document.getElementById('mail-receiver-display');
    if(count === 0) display.value = "";
    else if(count === allUsersCache.length) display.value = `전체 유저 (${count}명)`;
    else display.value = `${count}명 선택됨`;
    closeUserModal();
}
async function sendAdminMail() {
    if(selectedUsers.size === 0) { alert("받는 사람을 선택해주세요."); return; }
    const receivers = Array.from(selectedUsers);
    const title = document.getElementById('mail-title').value;
    const content = document.getElementById('mail-content').value;
    const scheduledTime = document.getElementById('mail-scheduled').value;
    if(!title || !content) { alert("제목과 내용을 입력해주세요."); return; }
    let formattedTime = null;
    if(scheduledTime) formattedTime = scheduledTime.replace("T", " ") + ":00";
    if(!confirm(`총 ${receivers.length}명에게 우편을 보낼까요?`)) return;
    try {
        const res = await fetch(`${API_MAIL}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: "운영자", receivers: receivers, title: title, content: content, scheduled_at: formattedTime })
        });
        if(res.ok) {
            alert("발송되었습니다!");
            document.getElementById('mail-title').value = "";
            document.getElementById('mail-content').value = "";
            document.getElementById('mail-scheduled').value = "";
            document.getElementById('mail-receiver-display').value = "";
            selectedUsers.clear();
        } else { alert("발송 실패: " + (await res.json()).detail); }
    } catch(err) { alert("서버 오류"); }
}
function openMailHistory() { document.getElementById('history-modal').style.display = 'flex'; fetchMailHistory(); }
function closeHistoryModal() { document.getElementById('history-modal').style.display = 'none'; }
async function fetchMailHistory() {
    try {
        const res = await fetch(`${API_MAIL}/admin/history?admin_key=${encodeURIComponent(currentAdminKey)}`);
        const list = await res.json();
        const container = document.getElementById('mail-history-list');
        if(list.length === 0) { container.innerHTML = "<p style='text-align:center; color:#999; margin-top:20px;'>발송 내역이 없습니다.</p>"; return; }
        container.innerHTML = list.map(item => {
            const isScheduled = item.scheduled_at && new Date(item.scheduled_at) > new Date();
            const statusTag = isScheduled ? `<span class="tag-scheduled">예약중 (${item.scheduled_at})</span>` : `<span class="tag-sent">발송완료</span>`;
            const cancelBtn = isScheduled ? `<button onclick="cancelMailBatch('${item.batch_id}')" class="btn-small reject" style="margin-top:5px;">발송 취소</button>` : `<button class="btn-small" style="background:#eee; color:#aaa; cursor:default; margin-top:5px;" disabled>취소 불가</button>`;
            return `
                <div class="history-item">
                    <div style="display:flex; justify-content:space-between; align-items:start;"><strong>${item.title}</strong>${statusTag}</div>
                    <p style="font-size:12px; color:#555; margin:5px 0;">${item.content}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#888;"><span>수신: ${item.receiver_count}명 | 작성: ${item.created_at.substring(0,16)}</span>${cancelBtn}</div>
                </div>`;
        }).join('');
    } catch(err) { console.error(err); }
}
async function cancelMailBatch(batchId) {
    if(!confirm("정말 취소하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_MAIL}/admin/cancel/${batchId}?admin_key=${encodeURIComponent(currentAdminKey)}`, { method: 'DELETE' });
        if(res.ok) { alert("취소되었습니다."); fetchMailHistory(); } else { alert("오류 발생"); }
    } catch(e) { alert("서버 오류"); }
}
async function approve(id, action) {
    if (!confirm("정말 처리하시겠습니까?")) return;
    try {
        const res = await fetch(`${API_BASE}/admin/approve?user_id=${id}&action=${action}&admin_key=${encodeURIComponent(currentAdminKey)}`, { method: 'POST' });
        if(res.ok) { alert("완료되었습니다."); loadAdminRequests(); } else { alert("오류 발생"); }
    } catch (err) { alert("서버 통신 오류"); }
}
function goToDBManager() {
    const dbKeyInput = document.getElementById('db-master-key-input');
    const key = dbKeyInput ? dbKeyInput.value.trim() : "";
    if(!key) { alert("2차 보안 키를 입력하세요."); return; }
    sessionStorage.setItem('dbKey', key);
    location.href = 'db_manager.html';
}
window.loadAdminRequests = loadAdminRequests;
window.refreshData = refreshData;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.toggleSelectAll = toggleSelectAll;
window.updateSelection = updateSelection;
window.confirmUserSelection = confirmUserSelection;
window.filterUsers = filterUsers;
window.sendAdminMail = sendAdminMail;
window.openMailHistory = openMailHistory;
window.closeHistoryModal = closeHistoryModal;
window.cancelMailBatch = cancelMailBatch;
window.approve = approve;
window.goToDBManager = goToDBManager;