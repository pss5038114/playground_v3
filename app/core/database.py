import sqlite3
import os

# DB 경로 설정 (프로젝트 루트)
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
DB_PATH = os.path.join(project_root, "playground.db")

def get_db_connection():
    """DB 연결 객체를 생성하여 반환합니다."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """서버 시작 시 테이블 생성 및 컬럼 마이그레이션을 담당합니다."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 유저 테이블 초기 생성
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT UNIQUE, 
            password_hash TEXT, 
            nickname TEXT,
            status TEXT DEFAULT 'pending_signup',
            pending_password_hash TEXT DEFAULT NULL
        )
    """)

    # 2. 마이그레이션: 현재 컬럼 목록 확인 및 부족한 컬럼 추가
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [row['name'] for row in cursor.fetchall()]

    required_columns = {
        "status": "TEXT DEFAULT 'pending_signup'",
        "pending_password_hash": "TEXT DEFAULT NULL"
    }

    for col_name, col_def in required_columns.items():
        if col_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                print(f"✅ DB 마이그레이션: '{col_name}' 컬럼 추가 완료")
            except Exception as e:
                print(f"❌ DB 마이그레이션 오류 ({col_name}): {e}")

    conn.commit()
    conn.close()
    print(f"🚀 데이터베이스 시스템 준비 완료: {DB_PATH}")