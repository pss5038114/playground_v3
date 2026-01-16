import math
import random
from typing import List, Dict, Optional

# 몹 타입 상수
MOB_NORMAL = "normal"
MOB_SPEED = "speed"
MOB_BIG = "big"
MOB_BOSS_KNIGHT = "knight"

# 게임 상태 상수
PHASE_NORMAL = "normal"      # 30초 진행
PHASE_GATHERING = "gathering" # 2초 (보스 등장 전 몹 모으기)
PHASE_BOSS = "boss"          # 보스 처치 전까지

class Mob:
    def __init__(self, mob_id: str, m_type: str, hp: float, path: list):
        self.id = mob_id
        self.type = m_type
        self.max_hp = hp
        self.hp = hp
        self.path = path # 픽셀 좌표 리스트
        
        # 기본 설정 (타입별 스탯)
        self.speed = 100.0 # 픽셀/초 (기본 속도)
        self.radius = 20   # 반지름
        
        if m_type == MOB_NORMAL:
            self.radius = 20
        elif m_type == MOB_SPEED:
            self.speed *= 1.5  # 150%
            self.radius = 15
        elif m_type == MOB_BIG:
            self.speed *= 0.85 # 85%
            self.radius = 35
        elif m_type == MOB_BOSS_KNIGHT:
            self.speed *= 0.6  # 보스는 좀 느리게 설정 (임의)
            self.radius = 60

        # 이동 상태
        self.distance_traveled = 0.0
        self.finished = False
        self.x = path[0]['x']
        self.y = path[0]['y']

    def move(self, dt: float):
        """경로를 따라 이동 (단순화된 경로 추적)"""
        move_dist = self.speed * dt
        self.distance_traveled += move_dist
        
        # 현재 이동 거리에 맞는 좌표 계산
        current_dist = 0.0
        for i in range(len(self.path) - 1):
            p1, p2 = self.path[i], self.path[i+1]
            seg_len = math.hypot(p2['x'] - p1['x'], p2['y'] - p1['y'])
            
            if current_dist + seg_len >= self.distance_traveled:
                # 이 세그먼트 위에 있음
                ratio = (self.distance_traveled - current_dist) / seg_len
                self.x = p1['x'] + (p2['x'] - p1['x']) * ratio
                self.y = p1['y'] + (p2['y'] - p1['y']) * ratio
                return
            
            current_dist += seg_len
        
        # 경로 끝 도달
        self.finished = True
        self.x = self.path[-1]['x']
        self.y = self.path[-1]['y']

class SoloGameLogic:
    def __init__(self):
        # 맵 설정 (기존 코드 유지 및 좌표계 수정)
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.board_rows = 4
        self.offset_x = (self.width - (7 * self.unit)) // 2 
        self.offset_y = (self.height - (self.board_rows * self.unit)) // 2 

        # 경로 (역 U자)
        self.path = [
            {'x': 0.5, 'y': 0.0}, 
            {'x': 0.5, 'y': 3.5},  
            {'x': 6.5, 'y': 3.5},  
            {'x': 6.5, 'y': 0.0}, 
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]

        # --- 게임 상태 변수 ---
        self.wave = 1
        self.phase = PHASE_NORMAL
        self.wave_timer = 0.0
        
        # 몹 관리
        self.mobs: List[Mob] = []
        self.mob_id_counter = 0
        self.spawn_timer = 0.0
        
        # HP 스케일링 (노멀 웨이브용)
        self.cur_base_hp_normal = 100.0 # 초기값
        self.hp_modifier_n = 0
        self.last_n_mark = 0

    def _to_pixel(self, ux, uy):
        return {
            'x': self.offset_x + ux * self.unit,
            'y': self.offset_y + (self.board_rows - uy) * self.unit
        }

    def update(self, dt: float):
        self.wave_timer += dt

        # 1. 페이즈별 로직
        if self.phase == PHASE_NORMAL:
            self._update_normal_wave(dt)
        elif self.phase == PHASE_GATHERING:
            self._update_gathering(dt)
        elif self.phase == PHASE_BOSS:
            self._update_boss_wave(dt)

        # 2. 몹 이동 및 제거
        for mob in self.mobs[:]:
            mob.move(dt)
            if mob.finished:
                # TODO: 플레이어 체력 감소 로직
                self.mobs.remove(mob)
            elif mob.hp <= 0:
                self.mobs.remove(mob)
                # TODO: SP 보상 지급

    def _update_normal_wave(self, dt: float):
        # 30초 제한
        if self.wave_timer >= 30.0:
            print(f"[Wave {self.wave}] Normal Phase Ended. Gathering...")
            self.phase = PHASE_GATHERING
            self.wave_timer = 0.0
            return

        # HP 스케일링 (요청하신 로직)
        # 10초마다 노멀 몹 체력 증가
        if int(self.wave_timer // 10) > self.last_n_mark:
            self.hp_modifier_n += 1
            self.cur_base_hp_normal += (100 * self.hp_modifier_n)
            self.last_n_mark = int(self.wave_timer // 10)
            print(f"HP Scaling Updated: BaseHP={self.cur_base_hp_normal}")

        # 몹 소환 (단순 주기적 소환 - 1.5초마다 랜덤 타입)
        self.spawn_timer += dt
        if self.spawn_timer >= 1.5:
            self.spawn_timer = 0
            m_type = random.choice([MOB_NORMAL, MOB_NORMAL, MOB_SPEED, MOB_BIG])
            self._spawn_mob(m_type)

    def _update_gathering(self, dt: float):
        # 2초 동안 대기 (몹들이 시작점으로 모이는 연출은 클라이언트에서 처리하거나,
        # 여기서 좌표를 강제로 0으로 옮길 수도 있음. 일단은 대기 상태로 둠)
        if self.wave_timer >= 2.0:
            # 보스 소환 전 남은 몹들의 HP 합 계산
            remaining_hp_sum = sum(m.hp for m in self.mobs)
            
            # 기존 몹 제거 (시작점으로 모이는 효과 후 사라지거나 흡수됨?)
            # 요청사항: "모이는 효과 이후 보스 몹이 나타남" -> 기존 몹들은 보스에게 흡수된 것으로 간주하여 제거
            self.mobs.clear() 

            print(f"[Wave {self.wave}] Boss Spawning! Remaining HP Sum: {remaining_hp_sum}")
            self._spawn_boss(remaining_hp_sum)
            
            self.phase = PHASE_BOSS
            self.wave_timer = 0.0

    def _update_boss_wave(self, dt: float):
        # 보스가 죽거나 도착해서 몹 리스트가 비면 웨이브 종료
        if not self.mobs:
            print(f"[Wave {self.wave}] Boss Defeated! Next Wave Starting...")
            self._next_wave()

    def _next_wave(self):
        self.wave += 1
        self.phase = PHASE_NORMAL
        self.wave_timer = 0.0
        self.hp_modifier_n = 0
        self.last_n_mark = 0
        # cur_base_hp_normal은 유지되거나 초기화? (보통 유지되면서 더 강해짐, 여기선 유지)

    def _spawn_mob(self, m_type: str):
        self.mob_id_counter += 1
        mob_id = f"m_{self.mob_id_counter}"
        
        # 체력 계산
        hp = self.cur_base_hp_normal
        if m_type == MOB_SPEED:
            hp = 50 + (self.cur_base_hp_normal - 100) * 0.5 # 기본비율 유지? (일단 요청대로 50 고정+보정치)
            # 요청: "초기 체력 50". 스케일링이 적용되는지 명시되지 않았으나, 
            # "초기체력에서... 더하는 식으로" 했으므로 기본값에 더함.
            hp = 50 + (self.cur_base_hp_normal - 100) # 베이스 증가분만큼 더해줌
        elif m_type == MOB_BIG:
            hp = 1000 + (self.cur_base_hp_normal - 100)

        new_mob = Mob(mob_id, m_type, hp, self.pixel_path)
        self.mobs.append(new_mob)

    def _spawn_boss(self, remaining_hp_sum: float):
        self.mob_id_counter += 1
        mob_id = f"BOSS_{self.wave}"
        
        # 보스 체력 공식
        # 25000 * (현재 웨이브) + 0.5 * (잔여 몬스터의 HP의 합)
        boss_hp = (25000 * self.wave) + (0.5 * remaining_hp_sum)
        
        new_mob = Mob(mob_id, MOB_BOSS_KNIGHT, boss_hp, self.pixel_path)
        self.mobs.append(new_mob)

    def get_state(self):
        """클라이언트에 보낼 데이터"""
        return {
            "wave": self.wave,
            "phase": self.phase,
            "timer": round(self.wave_timer, 1),
            "mobs": [
                {
                    "id": m.id,
                    "type": m.type,
                    "x": round(m.x),
                    "y": round(m.y),
                    "hp": round(m.hp),
                    "max_hp": round(m.max_hp),
                    "radius": m.radius
                }
                for m in self.mobs
            ]
        }