# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_rest_api import router as dice_router
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db # [NEW]

# [NEW] 앱 시작 시 DB 초기화 로직 수행
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() # 서버 시작 시 스키마 적용
    yield
    # 서버 종료 시 실행할 로직 (필요시 추가)

app = FastAPI(lifespan=lifespan) # lifespan 등록

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(dice_router, prefix="/api/dice", tags=["Dice Defense"])
app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is running!"}