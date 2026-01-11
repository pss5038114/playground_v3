from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import List, Optional, Any
from app.core.auth_logic import hash_password, verify_password
from app.core.database import get_db_connection
import re

router = APIRouter()

# [추가] 공통 인증 의존성 함수
async def get_current_user_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="잘못된 인증 방식입니다.")
        # 보안을 위해 실제 환경에서는 JWT를 사용해야 하나, 현재는 username을 토큰으로 사용합니다.
        return {"user_id": token, "username": token}
    except Exception:
        raise HTTPException(status_code=401, detail="인증 형식이 잘못되었습니다.")

# [보안 설정]
ADMIN_SECRET_KEY = "your_secret_key"
DB_MASTER_KEY = "master1234"

class AuthModel(BaseModel):
    username: str
    password: str
    nickname: Optional[str] = ""
    birthdate: Optional[str] = ""

class DBUpdateModel(BaseModel):
    table_name: str
    row_id: int
    column_name: str
    new_value: Any

class ProfileUpdateModel(BaseModel):
    username: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None

class PasswordChangeModel(BaseModel):
    username: str
    old_password: str
    birthdate: str
    new_password: str

# --- [중복 확인 API] ---
@router.get("/check-id/{username}")
async def check_id_duplicate(username: str):
    if len(username) < 4 or len(username) > 15:
        return {"available": False, "message": "4~15글자여야 합니다."}
    conn = get_db_connection()
    row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if row: return {"available": False, "message": "이미 사용 중인 아이디입니다."}
    return {"available": True, "message": "사용 가능한 아이디입니다."}

@router.get("/check-nick/{nickname}")
async def check_nick_duplicate(nickname: str):
    if len(nickname) < 1 or len(nickname) > 15:
        return {"available": False, "message": "1~15글자여야 합니다."}
    conn = get_db_connection()
    row = conn.execute("SELECT id FROM users WHERE nickname = ?", (nickname,)).fetchone()
    conn.close()
    if row: return {"available": False, "message": "이미 사용 중인 닉네임입니다."}
    return {"available": True, "message": "사용 가능한 닉네임입니다."}

# --- [유저 인증 API] ---
@router.post("/signup")
async def signup(user: AuthModel):
    if not (4 <= len(user.username) <= 15): raise HTTPException(status_code=400, detail="아이디 길이 오류")
    if not (1 <= len(user.nickname) <= 15): raise HTTPException(status_code=400, detail="닉네임 길이 오류")
    if not re.match(r"^\d{4}$", user.birthdate): raise HTTPException(status_code=400, detail="생일 형식 오류")

    conn = get_db_connection()
    try:
        exist_id = conn.execute("SELECT id FROM users WHERE username = ?", (user.username,)).fetchone()
        if exist_id: raise HTTPException(status_code=400, detail="이미 존재하는 ID입니다.")
        
        exist_nick = conn.execute("SELECT id FROM users WHERE nickname = ?", (user.nickname,)).fetchone()
        if exist_nick: raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")

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
        msg = "승인 대기 중입니다."
        if row["status"] == "pending_deletion": msg = "탈퇴 처리 대기 중입니다."
        elif row["status"] == "pending_reset": msg = "비밀번호 변경 승인 대기 중입니다."
        raise HTTPException(status_code=403, detail=msg)
    
    # [수정] dice_game.js에서 요구하는 access_token을 포함합니다.
    return {
        "access_token": row["username"],
        "nickname": row["nickname"],
        "username": row["username"]
    }

@router.post("/reset-request")
async def reset_request(user: AuthModel):
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ? AND birthdate = ?", (user.username, user.birthdate)).fetchone()
        if not row: raise HTTPException(status_code=404, detail="정보 불일치")
        
        conn.execute("UPDATE users SET status = 'pending_reset', pending_password_hash = ? WHERE username = ?",
                    (hash_password(user.password), user.username))
        conn.commit()
        return {"message": "성공"}
    finally: conn.close()

# --- [마이페이지 및 관리자 API (기존 유지)] ---
@router.get("/profile/{username}")
async def get_profile(username: str):
    conn = get_db_connection()
    row = conn.execute("SELECT nickname, birthdate, profile_image FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not row: raise HTTPException(status_code=404, detail="유저 없음")
    return dict(row)

@router.post("/update-profile")
async def update_profile(data: ProfileUpdateModel):
    conn = get_db_connection()
    try:
        if data.nickname:
            if not (1 <= len(data.nickname) <= 15): 
                raise HTTPException(status_code=400, detail="닉네임은 1~15자여야 합니다.")
            exist = conn.execute("SELECT username FROM users WHERE nickname = ?", (data.nickname,)).fetchone()
            if exist and exist['username'] != data.username:
                raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
            conn.execute("UPDATE users SET nickname = ? WHERE username = ?", (data.nickname, data.username))
        if data.profile_image:
            conn.execute("UPDATE users SET profile_image = ? WHERE username = ?", (data.profile_image, data.username))
        conn.commit()
        return {"message": "업데이트 완료"}
    finally: conn.close()

@router.post("/change-password")
async def change_password(data: PasswordChangeModel):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (data.username,)).fetchone()
        if not user or not verify_password(data.old_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="현재 비밀번호 불일치")
        if user["birthdate"] != data.birthdate:
            raise HTTPException(status_code=400, detail="생일 불일치")
        conn.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hash_password(data.new_password), data.username))
        conn.commit()
        return {"message": "성공"}
    finally: conn.close()

@router.post("/withdraw")
async def request_withdraw(user: AuthModel):
    conn = get_db_connection()
    conn.execute("UPDATE users SET status = 'pending_deletion' WHERE username = ?", (user.username,))
    conn.commit()
    conn.close()
    return {"message": "탈퇴 요청 접수"}

@router.get("/admin/pending")
async def get_pending_requests(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    conn = get_db_connection()
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
        if not row: return {"message": "유저 없음"}
        status = row["status"]
        if action == "approve":
            if status == "pending_signup":
                conn.execute("UPDATE users SET status = 'active' WHERE id = ?", (user_id,))
            elif status == "pending_reset":
                conn.execute("UPDATE users SET password_hash = pending_password_hash, pending_password_hash = NULL, status = 'active' WHERE id = ?", (user_id,))
            elif status == "pending_deletion":
                conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        else:
            if status == "pending_signup":
                conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            elif status == "pending_reset":
                conn.execute("UPDATE users SET status = 'active', pending_password_hash = NULL WHERE id = ?", (user_id,))
            elif status == "pending_deletion":
                conn.execute("UPDATE users SET status = 'active' WHERE id = ?", (user_id,)) 
        conn.commit()
    finally: conn.close()
    return {"message": "완료"}

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