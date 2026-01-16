# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services.auth.auth_api import router as auth_router
# [수정] 기존 rest_api와 신규 game_api(dice_api)를 모두 가져옵니다.
from app.services.dice_defense.dice_rest_api import router as dice_rest_router
from app.services.dice_defense.dice_api import router as dice_game_router
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server Starting... Initializing Database...")
    init_db()
    yield
    print(">>> Server Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])

# [중요] Dice Game Router(방 생성, 웹소켓)를 먼저 등록해야 합니다.
# 그래야 /create_room 같은 구체적인 경로가 먼저 매칭됩니다.
app.include_router(dice_game_router, prefix="/api/dice", tags=["Dice Game"])
app.include_router(dice_rest_router, prefix="/api/dice", tags=["Dice Defense"])

app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is running!"}