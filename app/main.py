from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import init_db
from app.core.global_ticker import ticker

# [1] 라우터 모듈 임포트
from app.services.auth import auth_api
from app.services.mail import mail_api
from app.services.dice_defense import dice_api  # <--- [신규] 다이스 API 추가

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시: DB 초기화 및 티커 실행
    init_db()
    await ticker.start()
    yield
    # 종료 시: 티커 정지
    await ticker.stop()

app = FastAPI(lifespan=lifespan)

# CORS 설정 (필요 시 수정)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [2] API 라우터 등록
app.include_router(auth_api.router, prefix="/api/auth", tags=["auth"])
app.include_router(mail_api.router, prefix="/api/mail", tags=["mail"])
app.include_router(dice_api.router, prefix="/api/dice", tags=["dice"]) # <--- [신규] 등록 필수!

# [3] 정적 파일 서빙 (HTML, CSS, JS)
app.mount("/web", StaticFiles(directory="web", html=True), name="web")

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is Running"}