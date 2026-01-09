import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # [필수] 웹 페이지 서빙을 위해 추가

from app.core.global_ticker import ticker
from app.core.database import init_db
from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_api import router as dice_router
from app.services.mail.mail_api import router as mail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. DB 초기화 및 테이블 생성
    init_db()
    print("✅ Database Initialized")
    
    # 2. Global Ticker (게임 루프 30Hz) 시작
    # 이 부분이 있어야 게임 시간이 흐릅니다.
    task = asyncio.create_task(ticker.start())
    print("💓 Global Ticker Started")
    
    yield  # 서버 실행 중...
    
    # 3. 서버 종료 시 정리
    task.cancel()
    print("🛑 Global Ticker Stopped")

app = FastAPI(title="Playground V3", lifespan=lifespan)

# CORS 설정 (모든 접속 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API 라우터 등록 ---
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# [수정] JS에서 fetch('/api/dice/...')로 호출하므로 경로를 /api/dice로 설정
app.include_router(dice_router, prefix="/api/dice", tags=["dice_defense"])

app.include_router(mail_router, prefix="/api/mail", tags=["mail"])


# --- [핵심 추가] 정적 파일 서빙 ---
# 이 코드가 있어야 http://localhost:8000/dice_game.html 접속이 가능합니다.
# 주의: 항상 다른 라우터들보다 가장 아래에 위치해야 합니다.
app.mount("/", StaticFiles(directory="web", html=True), name="web")