import asyncio
import time

class GlobalTicker:
    def __init__(self, fps=30):
        self.interval = 1 / fps
        self.sessions = []

    def subscribe(self, session):
        if session not in self.sessions:
            self.sessions.append(session)

    def unsubscribe(self, session):
        if session in self.sessions:
            self.sessions.remove(session)

    async def start(self):
        print(f"💓 Global Ticker 가동: {1/self.interval}Hz")
        while True:
            start_time = time.perf_counter()
            if self.sessions:
                await asyncio.gather(*(s.update() for s in self.sessions))
            
            elapsed = time.perf_counter() - start_time
            await asyncio.sleep(max(0, self.interval - elapsed))

ticker = GlobalTicker()