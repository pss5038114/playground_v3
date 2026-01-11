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
    print("--------------------------------------------------")
    print("✅ 서버가 정상적으로 재시작되었습니다! (버전 확인용)")
    print("--------------------------------------------------")
    init_db()
    task = asyncio.create_task(ticker.start())
    yield
    task.cancel()

app = FastAPI(title="Playground V3", lifespan=lifespan)

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
# [중요] API 라우터를 반드시 먼저 등록해야 합니다. (순서 엄수)
# -----------------------------------------------------------
app.include_router(auth_router, prefix="/api/auth")
app.include_router(mail_router, prefix="/api/mail")
app.include_router(dice_router, prefix="/api/dice")

# -----------------------------------------------------------
# [중요] 정적 파일(웹 화면) 마운트는 모든 API 등록이 끝난 '맨 마지막'에 합니다.
# -----------------------------------------------------------
if os.path.exists("web"):
    app.mount("/", StaticFiles(directory="web", html=True), name="web")