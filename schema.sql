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

CREATE TABLE IF NOT EXISTS user_decks (
    user_id INTEGER,
    preset_index INTEGER,
    deck_name TEXT DEFAULT 'Deck 1',
    slot_1 TEXT NOT NULL,
    slot_2 TEXT NOT NULL,
    slot_3 TEXT NOT NULL,
    slot_4 TEXT NOT NULL,
    slot_5 TEXT NOT NULL,
    PRIMARY KEY (user_id, preset_index),
    FOREIGN KEY (user_id) REFERENCES users (id)
);