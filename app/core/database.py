# app/core/database.py
import sqlite3
import os

# 현재 파일(database.py)의 위치를 기준으로 경로 설정 (더 안정적)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "playground.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print(f"[*] Checking Database at: {DB_PATH}")
    print(f"[*] Loading Schema from: {SCHEMA_PATH}")
    
    if not os.path.exists(SCHEMA_PATH):
        print(f"[!] Schema file not found at {SCHEMA_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema_script = f.read()
            # executescript는 여러 SQL 문을 한 번에 실행 가능
            # CREATE TABLE IF NOT EXISTS ... 구문이 있으므로 안전함
            conn.executescript(schema_script) 
            conn.commit()
            print("[*] Database schema applied successfully.")
    except Exception as e:
        print(f"[!] Error applying schema: {e}")
    finally:
        conn.close()