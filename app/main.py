# app/main.py
import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.global_ticker import ticker
from app.core.database import init_db
from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_api import router as dice_router
from app.services.mail.mail_api import router as mail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 DB 초기화 및 티커 실행
    init_db()
    task = asyncio.create_task(ticker.start())
    yield
    # 서버 종료 시 티커 중지 (선택 사항)
    task.cancel()

app = FastAPI(title="Playground V3", lifespan=lifespan)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [중요] API 라우터 등록 
# 정적 파일 마운트("/")보다 먼저 등록해야 API 요청이 정상적으로 처리됩니다.
app.include_router(auth_router, prefix="/api/auth")
app.include_router(mail_router, prefix="/api/mail")
app.include_router(dice_router, prefix="/api/dice")

# [중요] 정적 파일 마운트 (가장 마지막에 배치)
# "/" 경로가 다른 API 경로를 가로채지 않도록 맨 끝에 둡니다.
if os.path.exists("web"):
    app.mount("/", StaticFiles(directory="web", html=True), name="web")