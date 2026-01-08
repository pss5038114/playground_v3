from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db_connection

router = APIRouter()

class MailSendModel(BaseModel):
    sender: str
    receiver_username: str  # "ALL" 이면 전체 발송
    title: str
    content: str
    scheduled_at: Optional[str] = None

# 1. 읽지 않은 메일 개수 확인 (알림용)
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

# [신규] 2. 특정 메일 하나만 읽음 처리 (클릭 시 호출)
@router.put("/read/{mail_id}")
async def read_one_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("UPDATE messages SET is_read = 1 WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "Read updated"}

# [유지] 3. 읽은 메일 모두 삭제 (휴지통)
@router.delete("/delete-read/{username}")
async def delete_read_mails(username: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE receiver_id = ? AND is_read = 1", (username,))
    conn.commit()
    conn.close()
    return {"message": "Read mails deleted"}

# 4. 내 우편함 목록 가져오기
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

# 5. 우편 보내기
@router.post("/send")
async def send_mail(mail: MailSendModel):
    conn = get_db_connection()
    try:
        if mail.receiver_username == "ALL":
            users = conn.execute("SELECT username FROM users WHERE status = 'active'").fetchall()
            if not users: return {"message": "보낼 유저가 없습니다."}
            
            data_to_insert = []
            for u in users:
                data_to_insert.append((mail.sender, u["username"], mail.title, mail.content, mail.scheduled_at))
            
            conn.executemany(
                """INSERT INTO messages (sender, receiver_id, title, content, scheduled_at) 
                   VALUES (?, ?, ?, ?, ?)""",
                data_to_insert
            )
            conn.commit()
            return {"message": f"전체 유저({len(users)}명)에게 전송 완료"}
        else:
            user = conn.execute("SELECT username FROM users WHERE username = ?", (mail.receiver_username,)).fetchone()
            if not user: raise HTTPException(status_code=404, detail="받는 유저가 없습니다.")
                
            conn.execute(
                """INSERT INTO messages (sender, receiver_id, title, content, scheduled_at) 
                   VALUES (?, ?, ?, ?, ?)""",
                (mail.sender, mail.receiver_username, mail.title, mail.content, mail.scheduled_at)
            )
            conn.commit()
            return {"message": "전송 완료"}
    finally:
        conn.close()

# 6. 개별 우편 삭제
@router.delete("/delete/{mail_id}")
async def delete_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "삭제됨"}