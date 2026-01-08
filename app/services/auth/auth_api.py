from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from app.core.auth_logic import hash_password, verify_password
from app.core.database import get_db_connection

router = APIRouter()

# [보안 설정] 관리자 키
ADMIN_SECRET_KEY = "your_secret_key"
DB_MASTER_KEY = "master1234"

class AuthModel(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = ""

class DBUpdateModel(BaseModel):
    table_name: str
    row_id: int
    column_name: str
    new_value: Any

# --- [유저 인증 API] ---
@router.post("/signup")
async def signup(user: AuthModel):
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, nickname, status) VALUES (?, ?, ?, 'pending_signup')",
            (user.username, hash_password(user.password), user.nickname or user.nickname)
        )
        conn.commit()
        return {"message": "성공"}
    except: raise HTTPException(status_code=400, detail="이미 존재하는 ID")
    finally: conn.close()

@router.post("/login")
async def login(user: AuthModel):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (user.username,)).fetchone()
    conn.close()
    if not row or not verify_password(user.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="ID/PW 불일치")
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="승인 대기 중")
    
    return {
        "nickname": row["nickname"],
        "username": row["username"]
    }

@router.post("/reset-request")
async def reset_request(user: AuthModel):
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (user.username,)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="유저 없음")
        conn.execute("UPDATE users SET status = 'pending_reset', pending_password_hash = ? WHERE username = ?",
                    (hash_password(user.password), user.username))
        conn.commit()
        return {"message": "성공"}
    finally: conn.close()

# --- [관리자 API] ---
@router.get("/admin/pending")
async def get_pending_requests(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    rows = conn.execute("SELECT id, username, nickname, status FROM users WHERE status != 'active'").fetchall()
    conn.close()
    return [dict(row) for row in rows]

# [신규] 관리자용 전체 유저 목록 조회 (메일 발송용)
@router.get("/admin/users")
async def get_all_users(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    # 탈퇴하지 않은 모든 유저 조회
    rows = conn.execute("SELECT username, nickname FROM users WHERE status = 'active'").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.post("/admin/approve")
async def approve_user(user_id: int, action: str, admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT status FROM users WHERE id = ?", (user_id,)).fetchone()
        if action == "approve":
            if row["status"] == "pending_reset":
                conn.execute("UPDATE users SET password_hash = pending_password_hash, pending_password_hash = NULL, status = 'active' WHERE id = ?", (user_id,))
            else:
                conn.execute("UPDATE users SET status = 'active' WHERE id = ?", (user_id,))
        else:
            if row["status"] == "pending_reset":
                conn.execute("UPDATE users SET status = 'active', pending_password_hash = NULL WHERE id = ?", (user_id,))
            else:
                conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    finally: conn.close()
    return {"message": "완료"}

# --- [DB 브라우저 API] ---
@router.get("/admin/db/tables")
async def get_tables(admin_key: str, db_key: str):
    if admin_key != ADMIN_SECRET_KEY or db_key != DB_MASTER_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
    result = []
    for t in tables:
        name = t["name"]
        cols = [c["name"] for c in conn.execute(f"PRAGMA table_info({name})").fetchall()]
        data = [dict(r) for r in conn.execute(f"SELECT * FROM {name}").fetchall()]
        result.append({"name": name, "columns": cols, "data": data})
    conn.close()
    return result

@router.post("/admin/db/update")
async def update_db_cell(data: DBUpdateModel, admin_key: str, db_key: str):
    if admin_key != ADMIN_SECRET_KEY or db_key != DB_MASTER_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    try:
        conn.execute(f"UPDATE {data.table_name} SET {data.column_name} = ? WHERE id = ?", (data.new_value, data.row_id))
        conn.commit()
    finally: conn.close()
    return {"message": "성공"}