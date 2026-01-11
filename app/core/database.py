import sqlite3
import os

# DB 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
DB_PATH = os.path.join(project_root, "playground.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 유저 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT UNIQUE, 
            password_hash TEXT, 
            nickname TEXT,
            birthdate TEXT,
            profile_image TEXT, -- [신규] 프로필 사진 (Base64)
            status TEXT DEFAULT 'pending_signup',
            pending_password_hash TEXT DEFAULT NULL
        )
    """)

    # 2. 우편함 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT,
            receiver_id TEXT,
            title TEXT,
            content TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            scheduled_at TIMESTAMP DEFAULT NULL,
            batch_id TEXT DEFAULT NULL
        )
    """)

    # --- 마이그레이션 로직 ---
    
    # 1) users 테이블 컬럼 확인
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [row['name'] for row in cursor.fetchall()]

    user_required = {
        "status": "TEXT DEFAULT 'pending_signup'",
        "pending_password_hash": "TEXT DEFAULT NULL",
        "birthdate": "TEXT DEFAULT NULL",
        "profile_image": "TEXT DEFAULT NULL" # [신규]
    }

    for col_name, col_def in user_required.items():
        if col_name not in user_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                print(f"✅ DB 마이그레이션: users 테이블 '{col_name}' 추가 완료")
            except Exception as e:
                print(f"❌ DB 마이그레이션 오류 (users): {e}")

    # 2) messages 테이블 컬럼 확인
    cursor.execute("PRAGMA table_info(messages)")
    msg_columns = [row['name'] for row in cursor.fetchall()]
    
    msg_required = {
        "scheduled_at": "TIMESTAMP DEFAULT NULL",
        "batch_id": "TEXT DEFAULT NULL"
    }

    for col_name, col_def in msg_required.items():
        if col_name not in msg_columns:
            try:
                cursor.execute(f"ALTER TABLE messages ADD COLUMN {col_name} {col_def}")
                print(f"✅ DB 마이그레이션: messages 테이블 '{col_name}' 추가 완료")
            except Exception as e:
                print(f"❌ DB 마이그레이션 오류 (messages): {e}")

    conn.commit()
    conn.close()
    print(f"🚀 데이터베이스 시스템 준비 완료: {DB_PATH}")