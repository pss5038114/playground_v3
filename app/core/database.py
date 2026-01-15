# app/core/database.py
import sqlite3
import os

# 프로젝트 루트 경로 계산 (app/core/database.py 기준 상위 3단계)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "playground.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print(f"[*] Initializing Database...")
    print(f"    - DB Path: {DB_PATH}")
    print(f"    - Schema Path: {SCHEMA_PATH}")
    
    if not os.path.exists(SCHEMA_PATH):
        print(f"[!] Schema file NOT FOUND at {SCHEMA_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    try:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema_script = f.read()
            conn.executescript(schema_script)
            conn.commit()
            print("[*] Database schema applied successfully.")
    except Exception as e:
        print(f"[!] Error applying schema: {e}")
    finally:
        conn.close()