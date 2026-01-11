import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.global_ticker import ticker
from app.core.database import init_db
from app.services.auth.auth_api import router as auth_router
from app.services.dice_defense.dice_api import router as dice_ws_router
from app.services.dice_defense.dice_rest_api import router as dice_rest_router # [추가]
from app.services.mail.mail_api import router as mail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
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

app.include_router(auth_router, prefix="/api/auth")
app.include_router(dice_ws_router, prefix="/ws/dice")
app.include_router(dice_rest_router, prefix="/api/dice") # [추가]
app.include_router(mail_router, prefix="/api/mail")