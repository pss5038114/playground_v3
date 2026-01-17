# app/services/dice_defense/modes/solo/game.py
import uuid
import random
import time
import math
from app.services.dice_defense.dice import get_dice_logic
from app.services.dice_defense.entities import get_entity_manager # [NEW]

class SoloGameSession:
    def __init__(self, user_id: int, deck: list):
        self.game_id = str(uuid.uuid4())
        self.user_id = user_id
        self.deck = deck
        
        self.sp = 100       
        self.spawn_cost = 10
        self.lives = 3
        self.wave = 1
        
        # [NEW] 엔티티 관리 (기존 mobs 대체)
        self.entities = [] 
        self.entity_id_counter = 0

        # [NEW] 투사체 관리
        self.projectiles = [] 
        self.projectile_id_counter = 0
        
        self.last_spawn_time = time.time()
        self.spawn_interval = 1.0 
        
        # 맵 설정 (기존 유지)
        self.width = 1080
        self.height = 1920
        self.unit = 140
        self.offset_x = (self.width - (7 * self.unit)) // 2
        self.offset_y = (self.height - (5 * self.unit)) // 2 
        
        self.path = [
            {'x': 0.5, 'y': 4.0}, {'x': 0.5, 'y': -0.5}, 
            {'x': 6.5, 'y': -0.5}, {'x': 6.5, 'y': 4.0},
        ]
        self.pixel_path = [self._to_pixel(p['x'], p['y']) for p in self.path]
        
        self.grid = []
        self._init_grid()
        
        self.last_update_time = time.time()

    def _to_pixel(self, ux, uy):
        return { 'x': self.offset_x + ux * self.unit, 'y': self.offset_y + uy * self.unit }

    def _init_grid(self):
        rows, cols = 3, 5
        cell_size = int(self.unit * 0.9)
        for r in range(rows):
            for c in range(cols):
                logic_x, logic_y = 1.5 + c, 0.5 + r
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

    # [수정] 메인 업데이트 루프
    def update(self):
        current_time = time.time()
        dt = current_time - self.last_update_time
        self.last_update_time = current_time
        
        # 1. 몹 스폰 (유지)
        if current_time - self.last_spawn_time >= self.spawn_interval:
            self._spawn_entity('normal_mob')
            self.last_spawn_time = current_time
            
        # 2. 엔티티 이동 (유지)
        active_entities = []
        entity_map = {} 
        for entity in self.entities:
            manager = get_entity_manager(entity['type'])
            manager.update_move(entity, self.pixel_path, dt)
            if entity.get('finished'):
                self.lives -= 1
            else:
                active_entities.append(entity)
                entity_map[entity['id']] = entity
        self.entities = active_entities
        
        # 3. 주사위 공격
        for cell in self.grid:
            dice = cell['dice']
            if dice:
                if 'cx' not in dice: dice['cx'] = cell['cx']; dice['cy'] = cell['cy']
                
                logic = get_dice_logic(dice['id'])
                
                # projectiles_list는 이제 리스트로 반환됨 (create_projectiles가 리스트 반환)
                projectiles_list = logic.update_attack(
                    dice, self.entities, dt, current_time, dice_size=cell['w']
                )
                
                if projectiles_list:
                    self._spawn_projectiles(projectiles_list)

        # 4. 투사체 이동
        self._update_projectiles(dt, entity_map) # entity_map은 위에서 생성된 것 사용
        
        return self.get_broadcast_state()

    # [수정] 투사체 생성 (리스트 처리)
    def _spawn_projectiles(self, proj_list):
        for info in proj_list:
            self.projectile_id_counter += 1
            self.projectiles.append({
                'id': self.projectile_id_counter,
                'dice_id': info['dice_id'], # [중요] 누가 쐈는지 기록
                'x': info['start_x'],
                'y': info['start_y'],
                'target_id': info['target_id'],
                'speed': info['speed'],
                'damage': info['damage'],
                'hit': False
            })

    # [수정] 투사체 업데이트 및 [3] 데미지 로직 위임
    def _update_projectiles(self, dt, entity_map):
        active_projectiles = []
        
        for proj in self.projectiles:
            target = entity_map.get(proj['target_id'])
            
            if not target: continue # 타겟 소실 시 투사체 삭제 (또는 유도 해제)
                
            dx = target['x'] - proj['x']
            dy = target['y'] - proj['y']
            dist = math.sqrt(dx*dx + dy*dy)
            move_dist = proj['speed'] * dt
            
            hit_threshold = target['hitbox_radius'] + 5 
            
            if dist <= hit_threshold or (dist <= move_dist):
                # [Hit 발생!]
                # 여기서 직접 데미지를 주지 않고, 주사위 로직에게 위임
                logic = get_dice_logic(proj['dice_id'])
                
                # [3] 특수 데미지 로직 실행 (전체 엔티티 리스트 전달 -> 스플래시/체인 등 처리용)
                logic.on_hit(target, proj, self.entities)
                
                # 투사체 소멸 (관통 로직이 있다면 여기서 처리 가능)
                # target['hp'] 체크는 다음 update 루프에서 처리됨
            else:
                proj['x'] += (dx / dist) * move_dist
                proj['y'] += (dy / dist) * move_dist
                active_projectiles.append(proj)
                
        self.projectiles = active_projectiles

    # [NEW] 엔티티 생성 함수
    def _spawn_entity(self, entity_type: str):
        self.entity_id_counter += 1
        start_node = self.pixel_path[0]
        
        # Factory를 통해 초기 상태 생성
        manager = get_entity_manager(entity_type)
        new_entity_state = manager.create_state(self.entity_id_counter, start_node)
        
        self.entities.append(new_entity_state)

    # [기존 로직 유지]
    def process_command(self, command: dict):
        ctype = command.get('type')
        if ctype == 'SPAWN': return self._spawn_dice()
        elif ctype == 'MERGE': return self._handle_merge(command)
        return None

    def _spawn_dice(self):
        if self.sp < self.spawn_cost: return None
        empty_indices = [i for i, cell in enumerate(self.grid) if cell['dice'] is None]
        if not empty_indices: return None
        target_idx = random.choice(empty_indices)
        dice_id = random.choice(self.deck)
        self.grid[target_idx]['dice'] = { 'id': dice_id, 'level': 1 }
        self.sp -= self.spawn_cost
        self.spawn_cost += 10
        return True

    def _handle_merge(self, command):
        try:
            src_idx = command.get('source_index')
            tgt_idx = command.get('target_index')
            if src_idx is None or tgt_idx is None or src_idx == tgt_idx: return None
            if not (0 <= src_idx < len(self.grid)) or not (0 <= tgt_idx < len(self.grid)): return None

            src_cell = self.grid[src_idx]
            tgt_cell = self.grid[tgt_idx]
            src_dice = src_cell['dice']
            tgt_dice = tgt_cell['dice']
            
            if not src_dice or not tgt_dice: return None
            
            logic = get_dice_logic(src_dice['id'])
            if logic.can_merge_with(src_dice, tgt_dice):
                new_dice_state = logic.on_merge(src_dice, tgt_dice, self.deck)
                self.grid[tgt_idx]['dice'] = new_dice_state
                self.grid[src_idx]['dice'] = None
                return True
        except Exception:
            pass
        return None

    def get_broadcast_state(self):
        return {
            "type": "STATE_UPDATE",
            "sp": int(self.sp),
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": [cell['dice'] for cell in self.grid],
            "entities": self.entities,
            "projectiles": self.projectiles # [NEW] 투사체 전송
        }

    def get_initial_state(self):
        return {
            "type": "INIT",
            "game_id": self.game_id,
            "map": { "width": self.width, "height": self.height, "path": self.pixel_path, "grid": self.grid },
            "state": self.get_broadcast_state()
        }