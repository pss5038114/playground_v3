import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles  # [필수] 정적 파일 서빙을 위해 추가
from fastapi.middleware.cors import CORSMiddleware

# Core 모듈
from app.core.global_ticker import ticker
from app.core.database import init_db

# 라우터 모듈 (사용자 스타일 유지)
from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_api import router as dice_router
from app.services.mail.mail_api import router as mail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. DB 초기화
    init_db()
    # 2. 게임 서버 심장박동(Ticker) 시작
    task = asyncio.create_task(ticker.start())
    yield
    # 3. 종료 시 정리
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

# [중요] 정적 파일 마운트 (이게 있어야 dice_game.html에 접속 가능)
app.mount("/web", StaticFiles(directory="web"), name="web")

# 라우터 등록
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])
# JS(dice_game.js)와 주소를 맞추기 위해 /api/game으로 변경
app.include_router(dice_router, prefix="/api/game", tags=["DiceDefense"])