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
    scheduled_at: Optional[str] = None  # [신규] 예약 시간 (YYYY-MM-DD HH:MM:SS)

# 1. 내 우편함 목록 가져오기 (예약된 시간이 지났거나, 예약이 없는 것만)
@router.get("/list/{username}")
async def get_my_mails(username: str):
    conn = get_db_connection()
    # SQL 로직: 내 아이디 AND (예약시간이 NULL 이거나 OR 예약시간이 현재시간보다 과거일 때)
    # datetime('now', 'localtime')을 사용하여 현지 시간 기준으로 비교합니다.
    query = """
        SELECT * FROM messages 
        WHERE receiver_id = ? 
        AND (scheduled_at IS NULL OR scheduled_at <= datetime('now', 'localtime'))
        ORDER BY id DESC
    """
    rows = conn.execute(query, (username,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]

# 2. 우편 보내기 (예약 시간 지원)
@router.post("/send")
async def send_mail(mail: MailSendModel):
    conn = get_db_connection()
    try:
        # 받는 유저 확인
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

# 3. 우편 삭제
@router.delete("/delete/{mail_id}")
async def delete_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "삭제됨"}