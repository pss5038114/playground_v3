import sqlite3
import os

# 프로젝트 루트 디렉토리 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
DB_PATH = os.path.join(project_root, "playground.db")

def get_db_connection():
    """데이터베이스 연결 객체를 반환합니다."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # 컬럼명으로 접근 가능하게 설정
    return conn

def init_db():
    """DB 테이블 초기화 및 마이그레이션"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. 유저 테이블 생성
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            username TEXT UNIQUE, 
            password_hash TEXT, 
            nickname TEXT,
            birthdate TEXT,
            profile_image TEXT,
            status TEXT DEFAULT 'pending_signup',
            pending_password_hash TEXT DEFAULT NULL,
            gold INTEGER DEFAULT 0,
            gem INTEGER DEFAULT 0
        )
    """)

    # 2. 메시지 테이블 (기존 기능 유지)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT,
            receiver TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT 0
        )
    """)

    # 3. [신규] 유저 보유 주사위 정보
    # level: 주사위 클래스, count: 현재 보유한 카드 수
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_dice (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            dice_id TEXT,
            level INTEGER DEFAULT 1,
            count INTEGER DEFAULT 0,
            UNIQUE(user_id, dice_id)
        )
    """)

    # 4. [신규] 유저 덱 설정 (5칸)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_decks (
            user_id TEXT PRIMARY KEY,
            slot_0 TEXT DEFAULT NULL,
            slot_1 TEXT DEFAULT NULL,
            slot_2 TEXT DEFAULT NULL,
            slot_3 TEXT DEFAULT NULL,
            slot_4 TEXT DEFAULT NULL
        )
    """)

    # --- 마이그레이션: 기존 users 테이블에 gold/gem 컬럼이 없으면 추가 ---
    cursor.execute("PRAGMA table_info(users)")
    columns = [row['name'] for row in cursor.fetchall()]
    
    if "gold" not in columns:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN gold INTEGER DEFAULT 0")
            print("Migration: Added 'gold' column to users.")
        except Exception as e:
            print(f"Migration Error (gold): {e}")

    if "gem" not in columns:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN gem INTEGER DEFAULT 0")
            print("Migration: Added 'gem' column to users.")
        except Exception as e:
            print(f"Migration Error (gem): {e}")

    conn.commit()
    conn.close()
    print(f"🚀 데이터베이스 초기화 완료: {DB_PATH}")

# 모듈 로드 시 DB 초기화 실행 (선택 사항, 메인에서 호출 권장)
if __name__ == "__main__":
    init_db()