CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    nickname TEXT
);

CREATE TABLE IF NOT EXISTS user_decks (
    user_id INTEGER PRIMARY KEY,
    slot_0 TEXT,
    slot_1 TEXT,
    slot_2 TEXT,
    slot_3 TEXT,
    slot_4 TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);