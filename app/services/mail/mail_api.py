from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db_connection

router = APIRouter()

class MailSendModel(BaseModel):
    sender: str
    receiver_username: str
    title: str
    content: str

# 1. 내 우편함 목록 가져오기
@router.get("/list/{username}")
async def get_my_mails(username: str):
    conn = get_db_connection()
    # 최신순으로 정렬해서 가져오기
    rows = conn.execute(
        "SELECT * FROM messages WHERE receiver_id = ? ORDER BY id DESC", 
        (username,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

# 2. 우편 보내기 (운영자용 또는 테스트용)
@router.post("/send")
async def send_mail(mail: MailSendModel):
    conn = get_db_connection()
    try:
        # 받는 사람이 실제 존재하는지 확인
        user = conn.execute("SELECT username FROM users WHERE username = ?", (mail.receiver_username,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="받는 유저가 없습니다.")
            
        conn.execute(
            "INSERT INTO messages (sender, receiver_id, title, content) VALUES (?, ?, ?, ?)",
            (mail.sender, mail.receiver_username, mail.title, mail.content)
        )
        conn.commit()
        return {"message": "전송 완료"}
    finally:
        conn.close()

# 3. 우편 읽음 처리 및 삭제
@router.delete("/delete/{mail_id}")
async def delete_mail(mail_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (mail_id,))
    conn.commit()
    conn.close()
    return {"message": "삭제됨"}