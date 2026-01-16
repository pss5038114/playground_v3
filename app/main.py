# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services.auth.auth_api import router as auth_router
# [변경] 두 개의 라우터를 모두 가져옵니다 (REST API, Game API)
from app.services.dice_defense.dice_rest_api import router as dice_rest_router
from app.services.dice_defense.dice_api import router as dice_game_router 
from app.services.mail.mail_api import router as mail_router
from app.core.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(">>> Server Starting... Initializing Database...")
    init_db() 
    yield
    print(">>> Server Shutting down...")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])

# [변경] Dice 관련 라우터 2개를 모두 등록합니다.
# prefix가 같아도 상관없습니다. 기능별로 합쳐집니다.
app.include_router(dice_rest_router, prefix="/api/dice", tags=["Dice Defense (Data)"])
app.include_router(dice_game_router, prefix="/api/dice", tags=["Dice Defense (Game)"])

app.include_router(mail_router, prefix="/api/mail", tags=["Mail"])

@app.get("/")
def read_root():
    return {"message": "Playground V3 API is running!"}