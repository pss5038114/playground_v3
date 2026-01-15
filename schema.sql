/* schema.sql */

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    gems INTEGER DEFAULT 0,
    gold INTEGER DEFAULT 0,
    tickets INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_dice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dice_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    class_level INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, dice_id)
);

/* [수정] 덱 프리셋 지원을 위한 테이블 재정의 */
/* 주의: 서버 재시작 시 기존 user_decks 데이터는 호환되지 않으므로 playground.db를 삭제하고 재시작하세요. */
DROP TABLE IF EXISTS user_decks;

CREATE TABLE user_decks (
    user_id INTEGER,
    preset_index INTEGER, -- 1~7
    deck_name TEXT DEFAULT 'Deck 1',
    slot_1 TEXT NOT NULL,
    slot_2 TEXT NOT NULL,
    slot_3 TEXT NOT NULL,
    slot_4 TEXT NOT NULL,
    slot_5 TEXT NOT NULL,
    PRIMARY KEY (user_id, preset_index),
    FOREIGN KEY (user_id) REFERENCES users (id)
);