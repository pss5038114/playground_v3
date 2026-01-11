from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.services.auth import auth_api
from app.services.mail import mail_api
from app.services.dice_defense import dice_api  # 추가됨
from app.core.database import init_db
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 시 DB 초기화
    init_db()
    yield
    # 종료 시 정리 작업 (필요하면 추가)

app = FastAPI(lifespan=lifespan)

# API 라우터 등록
app.include_router(auth_api.router, prefix="/api/auth", tags=["Auth"])
app.include_router(mail_api.router, prefix="/api/mail", tags=["Mail"])
app.include_router(dice_api.router, prefix="/api/game/dice", tags=["DiceDefense"]) # 추가됨

# 정적 파일 서빙 (HTML, CSS, JS)
app.mount("/static", StaticFiles(directory="web"), name="static")

# 루트 경로 핸들러 (선택 사항: index.html로 리다이렉트 등)
from fastapi.responses import FileResponse
@app.get("/")
async def read_root():
    return FileResponse("web/index.html")