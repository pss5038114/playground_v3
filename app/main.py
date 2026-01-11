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
    print("--------------------------------------------------")
    print("🚀 Playground V3 백엔드 서버 시작")
    print("--------------------------------------------------")
    init_db()
    task = asyncio.create_task(ticker.start())
    yield
    # 서버 종료 시 티커 중지
    task.cancel()

app = FastAPI(title="Playground V3", lifespan=lifespan)

# CORS 설정: Cloudflare Pages(프론트)에서 Tunnel(백엔드)로의 접근을 허용합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [디버깅용] 서버 생존 확인용 API
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Server is running!"}

# -----------------------------------------------------------
# [중요] API 라우터 등록 (기존 모든 라우터 유지)
# -----------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth")
app.include_router(mail_router, prefix="/api/mail")
app.include_router(dice_router, prefix="/api/dice")

# -----------------------------------------------------------
# [중요] 정적 파일 마운트는 맨 마지막에 위치해야 합니다.
# -----------------------------------------------------------
if os.path.exists("web"):
    app.mount("/", StaticFiles(directory="web", html=True), name="web")