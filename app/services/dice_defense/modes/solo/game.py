# app/services/dice_defense/modes/solo/game.py
import math
import random
from typing import List, Dict, Optional

# ==========================================
# 1. 맵 데이터 (기존 코드 유지 및 활용)
# ==========================================
class SoloGameSession:
    """맵의 정적 데이터(좌표, 경로)를 관리하는 클래스"""
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
# 2. 엔티티 (Mob) 클래스 정의
# ==========================================
class Mob:
    def __init__(self, mob_id: int, path: List[dict], hp: float, speed: float, type_name: str):
        self.id = mob_id
        self.path = path # 픽셀 좌표 리스트 [{'x':..., 'y':...}, ...]
        self.hp = hp
        self.max_hp = hp
        self.speed = speed # pixels per second
        self.type = type_name
        
        # 경로 관련 상태
        self.path_index = 0 # 현재 목표로 하는 경로 포인트 인덱스
        self.x = path[0]['x']
        self.y = path[0]['y']
        self.finished = False # 방어선 도달 여부
        
        # 다음 목표 지점 설정 (시작점 -> 첫번째 경유지)
        self._set_next_target()

    def _set_next_target(self):
        self.path_index += 1
        if self.path_index < len(self.path):
            self.target_x = self.path[self.path_index]['x']
            self.target_y = self.path[self.path_index]['y']
            
            # 방향 벡터 계산
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

        # 이동 예상 거리
        move_dist = self.speed * dt
        
        # 현재 목표까지 남은 거리
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        dist_to_target = math.sqrt(dx*dx + dy*dy)

        if move_dist >= dist_to_target:
            # 목표 지점 도착 혹은 통과 -> 좌표를 목표점으로 맞추고 다음 지점 설정
            self.x = self.target_x
            self.y = self.target_y
            self._set_next_target()
            
            # 남은 거리만큼 더 이동해야 하지만, 간단하게 여기서 처리
        else:
            # 목표를 향해 이동
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

# 몹 타입별 클래스
class NormalMob(Mob):
    def __init__(self, mid, path):
        # 기준 속도: 140px/s (1초에 1유닛 이동) -> 13유닛 약 13초 주파
        super().__init__(mid, path, hp=100, speed=140, type_name="normal")

class SpeedMob(Mob):
    def __init__(self, mid, path):
        # 체력 50, 속도 150% (210px/s)
        super().__init__(mid, path, hp=50, speed=140 * 1.5, type_name="speed")

class BigMob(Mob):
    def __init__(self, mid, path):
        # 체력 1000, 속도 85% (119px/s)
        super().__init__(mid, path, hp=1000, speed=140 * 0.85, type_name="big")

class KnightBoss(Mob):
    def __init__(self, mid, path, wave, current_mobs_hp_sum):
        # 체력 공식: 25000 * Wave + 0.5 * (잔여 몹 체력 합)
        hp = (25000 * wave) + (0.5 * current_mobs_hp_sum)
        # 보스 속도는 일반 몹의 60% 정도로 가정 (설정 필요 시 수정)
        super().__init__(mid, path, hp=hp, speed=140 * 0.6, type_name="boss_knight")


# ==========================================
# 3. 게임 로직 (Game Logic)
# ==========================================
class SoloGameLogic:
    def __init__(self):
        # 맵 데이터 로드
        self.map_data = SoloGameSession()
        self.path = self.map_data.pixel_path
        
        # 게임 상태
        self.wave = 1
        self.wave_phase = "NORMAL" # "NORMAL" or "BOSS"
        self.wave_timer = 30.0     # 노멀 웨이브 지속 시간 (30초)
        
        self.mobs: List[Mob] = []
        self.mob_id_counter = 0
        
        # 스폰 타이머 (노멀 웨이브용)
        self.spawn_timer = 0.0
        self.spawn_interval = 2.0 # 2초마다 스폰 (임시)

    def update(self, dt: float):
        """매 틱(Tick)마다 호출되는 메인 로직"""
        
        # 1. 웨이브 관리
        if self.wave_phase == "NORMAL":
            self.wave_timer -= dt
            
            # 스폰 로직
            self.spawn_timer -= dt
            if self.spawn_timer <= 0:
                self.spawn_random_mob()
                self.spawn_timer = self.spawn_interval # 간격 초기화
            
            # 30초 종료 -> 보스 페이즈 전환
            if self.wave_timer <= 0:
                self.start_boss_phase()
        
        elif self.wave_phase == "BOSS":
            # 보스가 죽거나 도착했는지 확인
            # (보스 페이즈인데 보스 타입 몹이 하나도 없으면 다음 웨이브로)
            boss_exists = any(m.type == "boss_knight" for m in self.mobs)
            if not boss_exists:
                self.next_wave()

        # 2. 몹 이동 및 처리
        active_mobs = []
        for mob in self.mobs:
            mob.move(dt)
            
            # 경로 끝 도달 처리 (TODO: 라이프 차감)
            if mob.finished:
                # print(f"Mob {mob.id} reached the end.")
                continue # 리스트에서 제외 (삭제)
            
            # 체력 0 이하 처리 (TODO: SP 획득)
            if mob.hp <= 0:
                continue # 리스트에서 제외 (삭제)

            active_mobs.append(mob)
        
        self.mobs = active_mobs

    def spawn_random_mob(self):
        """일반/스피드/빅 몹 중 랜덤 소환"""
        self.mob_id_counter += 1
        r = random.random()
        if r < 0.6:
            new_mob = NormalMob(self.mob_id_counter, self.path)
        elif r < 0.85:
            new_mob = SpeedMob(self.mob_id_counter, self.path)
        else:
            new_mob = BigMob(self.mob_id_counter, self.path)
        
        self.mobs.append(new_mob)

    def start_boss_phase(self):
        print(f"=== WAVE {self.wave} BOSS PHASE START ===")
        self.wave_phase = "BOSS"
        
        # 잔여 몬스터 체력 합 계산
        rem_hp_sum = sum(m.hp for m in self.mobs)
        
        # 보스 소환
        self.mob_id_counter += 1
        boss = KnightBoss(self.mob_id_counter, self.path, self.wave, rem_hp_sum)
        self.mobs.append(boss)

    def next_wave(self):
        self.wave += 1
        print(f"=== WAVE {self.wave} START (NORMAL) ===")
        self.wave_phase = "NORMAL"
        self.wave_timer = 30.0
        self.spawn_timer = 1.0

    def get_state(self):
        """클라이언트에 전송할 게임 상태 스냅샷"""
        return {
            "wave": self.wave,
            "phase": self.wave_phase,
            "timer": round(self.wave_timer, 1) if self.wave_phase == "NORMAL" else 0,
            "mobs": [m.to_dict() for m in self.mobs]
        }