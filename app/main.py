# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware # [필수] 추가
from contextlib import asynccontextmanager

from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_rest_api import router as dice_router
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server Starting... Initializing Database...")
    init_db() 
    yield
    print(">>> Server Shutting down...")

app = FastAPI(lifespan=lifespan)

# [수정됨] 세션 미들웨어 추가 (SECRET_KEY는 임의로 설정하거나 환경변수 사용)
# 이게 없으면 dice_rest_api.py의 request.session에서 에러가 납니다.
app.add_middleware(
    SessionMiddleware, 
    secret_key="YOUR_SECRET_KEY_HERE", 
    max_age=3600  # 1시간 유지
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(dice_router, prefix="/api/dice", tags=["Dice Defense"])
app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is running!"}