/* schema.sql */
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    gems INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    /* [NEW] 덱 정보 저장 (콤마로 구분된 5개 ID, 예: "fire,wind,none,none,none") */
    deck TEXT DEFAULT 'none,none,none,none,none'
);

CREATE TABLE IF NOT EXISTS user_dice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dice_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    class_level INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS mail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    reward_type TEXT,
    reward_amount INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);