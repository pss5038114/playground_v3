# app/services/dice_defense/modes/solo/game.py
import math
import random
from typing import List, Dict, Optional

# ==========================================
# 1. 맵 데이터 (기존 유지)
# ==========================================
class SoloGameSession:
    def __init__(self):
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.board_rows = 4
        self.offset_x = (self.width - (7 * self.unit)) // 2 
        self.offset_y = (self.height - (self.board_rows * self.unit)) // 2 
        
        # 경로: (0.5, 0) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, 0)
        self.path = [
            {'x': 0.5, 'y': 0.0}, 
            {'x': 0.5, 'y': 3.5},  
            {'x': 6.5, 'y': 3.5},  
            {'x': 6.5, 'y': 0.0}, 
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()

    def _to_pixel(self, ux, uy):
        return {
            'x': self.offset_x + ux * self.unit,
            'y': self.offset_y + (self.board_rows - uy) * self.unit
        }

    def _init_grid(self):
        rows = 3
        cols = 5
        cell_size = int(self.unit * 0.9)
        for r in range(rows):
            for c in range(cols):
                logic_x = 1.0 + c + 0.5
                logic_y = 0.0 + r + 0.5
                center_pos = self._to_pixel(logic_x, logic_y)
                self.grid.append({
                    'index': r * cols + c,
                    'x': center_pos['x'] - cell_size // 2,
                    'y': center_pos['y'] - cell_size // 2,
                    'w': cell_size,
                    'h': cell_size,
                    'cx': center_pos['x'],
                    'cy': center_pos['y'],
                    'dice': None
                })

    def get_map_data(self):
        return {
            "width": self.width,
            "height": self.height,
            "path": self.pixel_path,
            "grid": self.grid
        }

# ==========================================
# 2. 엔티티 (Mob) 클래스
# ==========================================
class Mob:
    def __init__(self, mob_id: int, path: List[dict], hp: float, speed: float, type_name: str):
        self.id = mob_id
        self.path = path
        self.hp = hp
        self.max_hp = hp
        self.speed = speed
        self.type = type_name
        self.path_index = 0
        self.x = path[0]['x']
        self.y = path[0]['y']
        self.finished = False 
        self._set_next_target()

    def _set_next_target(self):
        self.path_index += 1
        if self.path_index < len(self.path):
            self.target_x = self.path[self.path_index]['x']
            self.target_y = self.path[self.path_index]['y']
            dx = self.target_x - self.x
            dy = self.target_y - self.y
            dist = math.sqrt(dx*dx + dy*dy)
            if dist > 0:
                self.vx = (dx / dist) * self.speed
                self.vy = (dy / dist) * self.speed
            else:
                self.vx, self.vy = 0, 0
        else:
            self.finished = True

    def move(self, dt: float):
        if self.finished: return
        move_dist = self.speed * dt
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        dist_to_target = math.sqrt(dx*dx + dy*dy)

        if move_dist >= dist_to_target:
            self.x = self.target_x
            self.y = self.target_y
            self._set_next_target()
        else:
            self.x += self.vx * dt
            self.y += self.vy * dt

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "x": round(self.x, 1),
            "y": round(self.y, 1)
        }

class NormalMob(Mob):
    def __init__(self, mid, path):
        super().__init__(mid, path, hp=100, speed=140, type_name="normal")

class SpeedMob(Mob):
    def __init__(self, mid, path):
        super().__init__(mid, path, hp=50, speed=140 * 1.5, type_name="speed")

class BigMob(Mob):
    def __init__(self, mid, path):
        # type_name을 'large'로 통일 (스폰 리스트와 매칭)
        super().__init__(mid, path, hp=1000, speed=140 * 0.85, type_name="large")

class KnightBoss(Mob):
    def __init__(self, mid, path, wave, extra_hp):
        # 체력 공식: 25000 * Wave + 0.5 * (잔여 몹 체력 합)
        hp = (25000 * wave) + (0.5 * extra_hp)
        super().__init__(mid, path, hp=hp, speed=140 * 0.6, type_name="boss_knight")


# ==========================================
# 3. 게임 로직 (Game Logic) - [수정됨]
# ==========================================
class SoloGameLogic:
    def __init__(self):
        self.map_data = SoloGameSession()
        self.path = self.map_data.pixel_path
        
        self.wave = 1
        self.wave_phase = "NORMAL"
        self.wave_timer = 30.0
        
        # [NEW] 라이프 시스템 (음수 허용)
        self.lives = 3
        
        self.mobs: List[Mob] = []
        self.mob_id_counter = 0
        
        # [NEW] 스폰 패턴 정의
        # normal 2 + speed 1 + large 1 + normal 4 + speed 1 + normal 6 + large 1 + speed 1 + normal 4
        self.spawn_pattern = (
            ['normal']*2 + ['speed']*1 + ['large']*1 + 
            ['normal']*4 + ['speed']*1 + ['normal']*6 + 
            ['large']*1 + ['speed']*1 + ['normal']*4
        )
        self.spawn_index = 0 # 패턴 내 현재 위치
        self.spawn_timer = 0.0
        self.spawn_interval = 1.0 # 1초마다 스폰

    def update(self, dt: float):
        # 1. 웨이브 관리
        if self.wave_phase == "NORMAL":
            self.wave_timer -= dt
            
            # 스폰 로직 (패턴 기반)
            self.spawn_timer -= dt
            if self.spawn_timer <= 0:
                if self.spawn_index < len(self.spawn_pattern):
                    mob_type = self.spawn_pattern[self.spawn_index]
                    self.spawn_mob(mob_type)
                    self.spawn_index += 1
                self.spawn_timer = self.spawn_interval
            
            # 30초 종료 -> 보스 페이즈 전환
            if self.wave_timer <= 0:
                self.start_boss_phase()
        
        elif self.wave_phase == "BOSS":
            # 보스 생존 여부 확인
            boss_exists = any(m.type == "boss_knight" for m in self.mobs)
            if not boss_exists:
                # 보스가 죽거나 도착해서 사라지면 다음 웨이브
                self.next_wave()

        # 2. 몹 이동 및 처리
        active_mobs = []
        for mob in self.mobs:
            mob.move(dt)
            
            # [NEW] 방어선 도달 처리 (라이프 차감)
            if mob.finished:
                loss = 2 if mob.type == "boss_knight" else 1
                self.lives -= loss
                # print(f"Mob reached end! Lives: {self.lives}")
                continue # 리스트에서 제거
            
            # 체력 0 이하 처리 (SP 획득 로직 추가 가능)
            if mob.hp <= 0:
                continue 

            active_mobs.append(mob)
        
        self.mobs = active_mobs

    def spawn_mob(self, mob_type: str):
        self.mob_id_counter += 1
        if mob_type == 'normal':
            new_mob = NormalMob(self.mob_id_counter, self.path)
        elif mob_type == 'speed':
            new_mob = SpeedMob(self.mob_id_counter, self.path)
        elif mob_type == 'large':
            new_mob = BigMob(self.mob_id_counter, self.path)
        else:
            new_mob = NormalMob(self.mob_id_counter, self.path)
        
        self.mobs.append(new_mob)

    def start_boss_phase(self):
        print(f"=== WAVE {self.wave} BOSS PHASE START ===")
        self.wave_phase = "BOSS"
        
        # [NEW] 잔여 몬스터 체력 합 계산 및 전원 삭제
        rem_hp_sum = sum(m.hp for m in self.mobs)
        self.mobs.clear() # 일반 몹 전부 삭제
        
        # 보스 소환 (삭제된 몹들의 체력을 흡수)
        self.mob_id_counter += 1
        boss = KnightBoss(self.mob_id_counter, self.path, self.wave, rem_hp_sum)
        self.mobs.append(boss)

    def next_wave(self):
        self.wave += 1
        print(f"=== WAVE {self.wave} START (NORMAL) ===")
        self.wave_phase = "NORMAL"
        self.wave_timer = 30.0
        self.spawn_index = 0 # 스폰 패턴 초기화
        self.spawn_timer = 1.0 # 1초 후 첫 스폰

    def get_state(self):
        return {
            "wave": self.wave,
            "phase": self.wave_phase,
            "timer": round(self.wave_timer, 1) if self.wave_phase == "NORMAL" else 0,
            "lives": self.lives, # [NEW] 라이프 상태 전송
            "mobs": [m.to_dict() for m in self.mobs]
        }