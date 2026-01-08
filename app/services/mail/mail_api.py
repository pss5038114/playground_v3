from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db_connection
import uuid

router = APIRouter()

# [보안 설정]
ADMIN_SECRET_KEY = "your_secret_key"

class MailSendModel(BaseModel):
    sender: str
    receivers: List[str]  # [변경] 여러 명 받기 (username 리스트)
    title: str
    content: str
    scheduled_at: Optional[str] = None

# 1. 내 우편함 목록 (기존 유지)
@router.get("/list/{username}")
async def get_my_mails(username: str):
    conn = get_db_connection()
    query = """
        SELECT * FROM messages 
        WHERE receiver_id = ? 
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))
        ORDER BY id DESC
    """
    rows = conn.execute(query, (username,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

# 2. 알림 체크 (기존 유지)
@router.get("/check/{username}")
async def check_unread_mail(username: str):
    conn = get_db_connection()
    query = """
        SELECT COUNT(*) as count FROM messages 
        WHERE receiver_id = ? 
        AND is_read = 0
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))
    """
    row = conn.execute(query, (username,)).fetchone()
    conn.close()
    return {"count": row["count"]}

# 3. 읽음/삭제 API (기존 유지)
@router.put("/read/{mail_id}")
async def read_one_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE messages SET is_read = 1 WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "Read updated"}

@router.put("/read-all/{username}")
async def mark_all_read(username: str):
    conn = get_db_connection()
    conn.execute("UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND is_read = 0 AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))", (username,))
    conn.commit()
    conn.close()
    return {"message": "All read"}

@router.delete("/delete-read/{username}")
async def delete_read_mails(username: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE receiver_id = ? AND is_read = 1", (username,))
    conn.commit()
    conn.close()
    return {"message": "Read mails deleted"}

@router.delete("/delete/{mail_id}")
async def delete_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "삭제됨"}

# --- [신규/수정] 관리자 우편 기능 ---

# 4. 우편 보내기 (다중 발송 + Batch ID 생성)
@router.post("/send")
async def send_mail(mail: MailSendModel):
    if not mail.receivers:
        return {"message": "받는 사람이 없습니다."}

    conn = get_db_connection()
    try:
        # 이번 발송을 묶어주는 고유 ID 생성
        batch_id = str(uuid.uuid4())[:8] 
        
        data_to_insert = []
        for receiver in mail.receivers:
            data_to_insert.append((
                mail.sender, receiver, mail.title, mail.content, mail.scheduled_at, batch_id
            ))
        
        conn.executemany(
            """INSERT INTO messages (sender, receiver_id, title, content, scheduled_at, batch_id) 
               VALUES (?, ?, ?, ?, ?, ?)""",
            data_to_insert
        )
        conn.commit()
        return {"message": f"{len(mail.receivers)}명에게 전송 완료 (Batch: {batch_id})"}
    finally:
        conn.close()

# 5. [신규] 관리자 - 보낸 우편 내역 확인 (그룹별 조회)
@router.get("/admin/history")
async def get_mail_history(admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    
    conn = get_db_connection()
    # Batch ID 별로 그룹화해서 보여줌 (제목, 내용, 예약시간, 수신인 수)
    query = """
        SELECT batch_id, title, content, scheduled_at, created_at, COUNT(*) as receiver_count 
        FROM messages 
        WHERE sender = '운영자' 
        GROUP BY batch_id 
        ORDER BY created_at DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(row) for row in rows]

# 6. [신규] 관리자 - 우편 발송 취소 (Batch 단위 삭제)
@router.delete("/admin/cancel/{batch_id}")
async def cancel_mail_batch(batch_id: str, admin_key: str):
    if admin_key != ADMIN_SECRET_KEY: raise HTTPException(status_code=401)
    
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE batch_id = ?", (batch_id,))
    conn.commit()
    conn.close()
    return {"message": "해당 발송 건이 모두 취소(삭제)되었습니다."}