import math
import random
from typing import List, Dict, Optional

# --- 상수 정의 ---
MOB_NORMAL = "normal"
MOB_SPEED = "speed"
MOB_BIG = "big"
MOB_BOSS_KNIGHT = "knight"

PHASE_NORMAL = "normal"       # 30초 웨이브
PHASE_GATHERING = "gathering" # 2초 (보스 등장 전 몹 정리)
PHASE_BOSS = "boss"           # 보스전

class Mob:
    def __init__(self, mob_id: str, m_type: str, hp: float, path: list):
        self.id = mob_id
        self.type = m_type
        self.max_hp = hp
        self.hp = hp
        self.path = path  # 픽셀 좌표 리스트 [{'x':.., 'y':..}, ...]
        
        # 기본 스탯 설정
        self.speed = 100.0 # 픽셀/초
        self.radius = 20   # 반지름
        
        if m_type == MOB_NORMAL:
            self.radius = 20
        elif m_type == MOB_SPEED:
            self.speed *= 1.5  # 150% 속도
            self.radius = 15
        elif m_type == MOB_BIG:
            self.speed *= 0.85 # 85% 속도
            self.radius = 35
        elif m_type == MOB_BOSS_KNIGHT:
            self.speed *= 0.6  # 보스는 느리게
            self.radius = 60   # 가장 큼

        # 이동 상태 관리
        self.distance_traveled = 0.0
        self.finished = False
        self.x = path[0]['x']
        self.y = path[0]['y']

    def move(self, dt: float):
        """경로를 따라 이동"""
        move_dist = self.speed * dt
        self.distance_traveled += move_dist
        
        current_dist = 0.0
        # 경로 세그먼트를 순회하며 현재 위치 계산
        for i in range(len(self.path) - 1):
            p1, p2 = self.path[i], self.path[i+1]
            seg_len = math.hypot(p2['x'] - p1['x'], p2['y'] - p1['y'])
            
            if current_dist + seg_len >= self.distance_traveled:
                # 현재 세그먼트 위에 있음
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
        # --- 맵 설정 (좌하단 0,0 좌표계 기준) ---
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.board_rows = 4 # 세로 4칸 기준
        
        # 중앙 정렬 오프셋
        self.offset_x = (self.width - (7 * self.unit)) // 2 
        self.offset_y = (self.height - (self.board_rows * self.unit)) // 2 

        # 경로: (0.5, 0) -> (0.5, 3.5) -> (6.5, 3.5) -> (6.5, 0)
        self.path = [
            {'x': 0.5, 'y': 0.0}, 
            {'x': 0.5, 'y': 3.5},  
            {'x': 6.5, 'y': 3.5},  
            {'x': 6.5, 'y': 0.0}, 
        ]
        # 실제 픽셀 좌표 변환
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]

        # --- 게임 상태 변수 ---
        self.wave = 1
        self.phase = PHASE_NORMAL
        self.wave_timer = 0.0
        
        # 몹 관리
        self.mobs: List[Mob] = []
        self.mob_id_counter = 0
        self.spawn_timer = 0.0
        
        # HP 스케일링 변수 (노멀 웨이브용)
        self.cur_base_hp_normal = 100.0
        self.hp_modifier_n = 0
        self.last_n_mark = 0

    def _to_pixel(self, ux, uy):
        """논리 좌표 -> 픽셀 좌표 (Y축 반전 처리)"""
        return {
            'x': self.offset_x + ux * self.unit,
            'y': self.offset_y + (self.board_rows - uy) * self.unit
        }

    def update(self, dt: float):
        self.wave_timer += dt

        # 1. 페이즈별 로직 실행
        if self.phase == PHASE_NORMAL:
            self._update_normal_wave(dt)
        elif self.phase == PHASE_GATHERING:
            self._update_gathering(dt)
        elif self.phase == PHASE_BOSS:
            self._update_boss_wave(dt)

        # 2. 몹 이동 및 제거 처리
        for mob in self.mobs[:]:
            mob.move(dt)
            if mob.finished:
                # TODO: 플레이어 체력 감소 로직 추가 필요
                self.mobs.remove(mob)
            elif mob.hp <= 0:
                self.mobs.remove(mob)
                # TODO: SP 보상 지급 로직 추가 필요

    def _update_normal_wave(self, dt: float):
        # 30초 지나면 게더링 페이즈로 전환
        if self.wave_timer >= 30.0:
            print(f"[Wave {self.wave}] Normal Phase Ended. Gathering...")
            self.phase = PHASE_GATHERING
            self.wave_timer = 0.0
            return

        # HP 스케일링 (요청하신 공식 적용)
        # 10초마다 cur_base_hp_normal 증가
        if int(self.wave_timer // 10) > self.last_n_mark:
            self.hp_modifier_n += 1
            self.cur_base_hp_normal += (100 * self.hp_modifier_n)
            self.last_n_mark = int(self.wave_timer // 10)
            print(f"HP Scaling Updated: BaseHP={self.cur_base_hp_normal}")

        # 몹 소환 (1.5초 간격)
        self.spawn_timer += dt
        if self.spawn_timer >= 1.5:
            self.spawn_timer = 0
            # 랜덤 몹 선택 (확률 조정 가능)
            m_type = random.choice([MOB_NORMAL, MOB_NORMAL, MOB_SPEED, MOB_BIG])
            self._spawn_mob(m_type)

    def _update_gathering(self, dt: float):
        # 2초 후 보스 스폰
        if self.wave_timer >= 2.0:
            # 남은 몹들의 HP 합산
            remaining_hp_sum = sum(m.hp for m in self.mobs)
            
            # 기존 몹 제거 (보스에게 흡수 연출)
            self.mobs.clear() 

            print(f"[Wave {self.wave}] Boss Spawning! Absorbed HP: {remaining_hp_sum}")
            self._spawn_boss(remaining_hp_sum)
            
            self.phase = PHASE_BOSS
            self.wave_timer = 0.0

    def _update_boss_wave(self, dt: float):
        # 보스가 죽거나(리스트가 비면) 웨이브 클리어
        if not self.mobs:
            print(f"[Wave {self.wave}] Boss Defeated! Next Wave Starting...")
            self._next_wave()

    def _next_wave(self):
        self.wave += 1
        self.phase = PHASE_NORMAL
        self.wave_timer = 0.0
        self.hp_modifier_n = 0
        self.last_n_mark = 0
        # cur_base_hp_normal은 초기화하지 않고 계속 증가된 상태를 유지할지,
        # 아니면 웨이브 기본값으로 재설정할지 결정 필요. (여기선 유지)

    def _spawn_mob(self, m_type: str):
        self.mob_id_counter += 1
        mob_id = f"m_{self.mob_id_counter}"
        
        # 몹 타입별 체력 계산
        hp = self.cur_base_hp_normal
        if m_type == MOB_SPEED:
            # 초기체력 50 + 스케일링 증가분
            hp = 50 + (self.cur_base_hp_normal - 100)
        elif m_type == MOB_BIG:
            # 초기체력 1000 + 스케일링 증가분
            hp = 1000 + (self.cur_base_hp_normal - 100)

        new_mob = Mob(mob_id, m_type, hp, self.pixel_path)
        self.mobs.append(new_mob)

    def _spawn_boss(self, remaining_hp_sum: float):
        self.mob_id_counter += 1
        mob_id = f"BOSS_{self.wave}"
        
        # 보스 체력 공식
        boss_hp = (25000 * self.wave) + (0.5 * remaining_hp_sum)
        
        new_mob = Mob(mob_id, MOB_BOSS_KNIGHT, boss_hp, self.pixel_path)
        self.mobs.append(new_mob)

    def get_state(self):
        """클라이언트로 전송할 게임 상태"""
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