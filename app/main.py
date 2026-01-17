from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager
import time

# 라우터 및 DB 로직 임포트
from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_rest_api import router as dice_router
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db

# 라이프사이클 (서버 시작/종료 시 실행)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server Starting... Initializing Database...")
    init_db() # DB 테이블 생성 확인
    yield
    print(">>> Server Shutting down...")

app = FastAPI(lifespan=lifespan)

# [설정] 1. 정적 파일 마운트 (CSS, JS, 이미지 등)
# 'web' 폴더를 '/static' 주소로도 접근 가능하게 함 (템플릿 내부 링크용)
app.mount("/static", StaticFiles(directory="web"), name="static")

# [설정] 2. 템플릿 엔진 설정 (HTML 파일들이 있는 폴더 지정)
templates = Jinja2Templates(directory="web")

# [핵심] 버전 생성 함수 (현재 시간 사용 -> 매번 캐시 갱신)
def get_app_version():
    return str(int(time.time()))

# 미들웨어 설정 (CORS)
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

# --- HTML 렌더링 라우터 (페이지 접속) ---

# 1. 로비 (index.html)
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    # index.html을 템플릿으로 렌더링하면서 'version' 변수를 주입
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "version": get_app_version() 
    })

# 2. 전투 화면 (play.html)
# 기존처럼 파일 경로로 접근하는 게 아니라, /play 경로로 접속하게 함
@app.get("/play", response_class=HTMLResponse)
async def play_game(request: Request):
    return templates.TemplateResponse("dice/play.html", {
        "request": request,
        "version": get_app_version()
    })