# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # [추가됨] 정적 파일 서빙용
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager
import os

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

# 세션 설정
app.add_middleware(
    SessionMiddleware, 
    secret_key="YOUR_SECRET_KEY_HERE", 
    max_age=3600
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(dice_router, prefix="/api/dice", tags=["Dice Defense"])
app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

# [핵심 수정] web 폴더를 서버에 연결 (이제 localhost:8000/web/... 으로 접속 가능)
# 주의: main.py가 app 폴더 안에 있으므로, web 폴더는 한 단계 위(../web)에 있습니다.
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
web_dir = os.path.join(base_dir, "web")

if os.path.exists(web_dir):
    app.mount("/web", StaticFiles(directory=web_dir, html=True), name="web")
else:
    print(f"Warning: 'web' directory not found at {web_dir}")

@app.get("/")
def read_root():
    # 루트 접속 시 게임 로비로 리다이렉트 안내 (선택 사항)
    return {"message": "Playground V3 API Running. Go to /web/dice/index.html to play!"}