from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db_connection

router = APIRouter()

class MailSendModel(BaseModel):
    sender: str
    receiver_username: str
    title: str
    content: str
    scheduled_at: Optional[str] = None

# [신규] 1. 읽지 않은 메일 개수 확인 (알림용)
@router.get("/check/{username}")
async def check_unread_mail(username: str):
    conn = get_db_connection()
    # 조건: 내 아이디 AND 읽지 않음(0) AND (예약 없거나 OR 예약 시간 지남)
    query = """
        SELECT COUNT(*) as count FROM messages 
        WHERE receiver_id = ? 
        AND is_read = 0
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))
    """
    row = conn.execute(query, (username,)).fetchone()
    conn.close()
    return {"count": row["count"]}

# [신규] 2. 메일 모두 읽음 처리 (우편함 열 때 호출)
@router.put("/read-all/{username}")
async def mark_all_read(username: str):
    conn = get_db_connection()
    # 현재 보여지는(예약 시간 지난) 메일만 읽음 처리
    query = """
        UPDATE messages 
        SET is_read = 1 
        WHERE receiver_id = ? 
        AND is_read = 0
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))
    """
    conn.execute(query, (username,)).commit()
    conn.close()
    return {"message": "All read"}

# 3. 내 우편함 목록 가져오기
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

# 4. 우편 보내기
@router.post("/send")
async def send_mail(mail: MailSendModel):
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT username FROM users WHERE username = ?", (mail.receiver_username,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="받는 유저가 없습니다.")
            
        conn.execute(
            """INSERT INTO messages (sender, receiver_id, title, content, scheduled_at) 
               VALUES (?, ?, ?, ?, ?)""",
            (mail.sender, mail.receiver_username, mail.title, mail.content, mail.scheduled_at)
        )
        conn.commit()
        return {"message": "전송 완료"}
    finally:
        conn.close()

# 5. 우편 삭제
@router.delete("/delete/{mail_id}")
async def delete_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "삭제됨"}