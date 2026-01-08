from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Any
from app.core.auth_logic import hash_password, verify_password
from app.core.database import get_db_connection
import re

router = APIRouter()

# [보안 설정]
ADMIN_SECRET_KEY = "your_secret_key"
DB_MASTER_KEY = "master1234"

class AuthModel(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = ""
    birthdate: Optional[str] = "" # [신규] 생일 (MMDD)

class DBUpdateModel(BaseModel):
    table_name: str
    row_id: int
    column_name: str
    new_value: Any

# --- [중복 확인 API] ---
@router.get("/check-id/{username}")
async def check_id_duplicate(username: str):
    if len(username) < 4 or len(username) > 15:
        return {"available": False, "message": "4~15글자여야 합니다."}
    
    conn = get_db_connection()
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    
    if row:
        return {"available": False, "message": "이미 사용 중인 아이디입니다."}
    return {"available": True, "message": "사용 가능한 아이디입니다."}

@router.get("/check-nick/{nickname}")
async def check_nick_duplicate(nickname: str):
    if len(nickname) < 1 or len(nickname) > 15:
        return {"available": False, "message": "1~15글자여야 합니다."}
        
    conn = get_db_connection()
    row = conn.execute("SELECT id FROM users WHERE nickname = ?", (nickname,)).fetchone()
    conn.close()
    
    if row:
        return {"available": False, "message": "이미 사용 중인 닉네임입니다."}
    return {"available": True, "message": "사용 가능한 닉네임입니다."}


# --- [유저 인증 API] ---
@router.post("/signup")
async def signup(user: AuthModel):
    # 1. 길이 검증 (백엔드 더블 체크)
    if not (4 <= len(user.username) <= 15):
        raise HTTPException(status_code=400, detail="아이디는 4~15자여야 합니다.")
    if not (1 <= len(user.nickname) <= 15):
        raise HTTPException(status_code=400, detail="닉네임은 1~15자여야 합니다.")
    if not re.match(r"^\d{4}$", user.birthdate):
        raise HTTPException(status_code=400, detail="생일은 4자리 숫자(MMDD)여야 합니다.")

    conn = get_db_connection()
    try:
        # 2. 중복 검사
        exist_id = conn.execute("SELECT id FROM users WHERE username = ?", (user.username,)).fetchone()
        if exist_id: raise HTTPException(status_code=400, detail="이미 존재하는 ID입니다.")
        
        exist_nick = conn.execute("SELECT id FROM users WHERE nickname = ?", (user.nickname,)).fetchone()
        if exist_nick: raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")

        # 3. 등록
        conn.execute(
            "INSERT INTO users (username, password_hash, nickname, birthdate, status) VALUES (?, ?, ?, ?, 'pending_signup')",
            (user.username, hash_password(user.password), user.nickname, user.birthdate)
        )
        conn.commit()
        return {"message": "성공"}
    finally: conn.close()

@router.post("/login")
async def login(user: AuthModel):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (user.username,)).fetchone()
    conn.close()
    
    if not row or not verify_password(user.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="ID/PW 불일치")
    if row["status"] != "active":
        raise HTTPException(status_code=403, detail="승인 대기 중입니다.")
    
    return {
        "nickname": row["nickname"],
        "username": row["username"]
    }

@router.post("/reset-request")
async def reset_request(user: AuthModel):
    # 생일 확인 로직 추가
    if not user.birthdate:
        raise HTTPException(status_code=400, detail="본인 확인을 위해 생일을 입력해주세요.")

    conn = get_db_connection()
    try:
        # 아이디와 생일이 일치하는지 확인
        row = conn.execute("SELECT * FROM users WHERE username = ? AND birthdate = ?", (user.username, user.birthdate)).fetchone()
        
        if not row: 
            raise HTTPException(status_code=404, detail="정보가 일치하는 유저가 없습니다.")
        
        conn.execute("UPDATE users SET status = 'pending_reset', pending_password_hash = ? WHERE username = ?",
                    (hash_password(user.password), user.username))
        conn.commit()
        return {"message": "성공"}
    finally: conn.close()

# --- [관리자 API] (기존 유지) ---
@router.get("/admin/pending")
async def get_pending_requests(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
    # birthdate도 같이 조회해서 보여주면 관리자가 확인하기 좋음
    rows = conn.execute("SELECT id, username, nickname, birthdate, status FROM users WHERE status != 'active'").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@router.get("/admin/users")
async def get_all_users(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
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

# --- [DB 브라우저 API] (기존 유지) ---
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