# app/services/dice_defense/modes/solo/game.py
import uuid
import random
import time
import math
from app.services.dice_defense.dice import get_dice_logic 

class SoloGameSession:
    # ... (기존 __init__, _init_grid, update, _spawn_mob, _move_mob 등 유지) ...
    def __init__(self, user_id: int, deck: list):
        self.game_id = str(uuid.uuid4())
        self.user_id = user_id
        self.deck = deck
        
        self.sp = 100       
        self.spawn_cost = 10
        self.lives = 3
        self.wave = 1
        
        self.mobs = []
        self.mob_id_counter = 0
        self.last_spawn_time = time.time()
        self.spawn_interval = 1.0 
        
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

    def update(self):
        current_time = time.time()
        dt = current_time - self.last_update_time
        self.last_update_time = current_time
        
        if current_time - self.last_spawn_time >= self.spawn_interval:
            self._spawn_mob()
            self.last_spawn_time = current_time
            
        active_mobs = []
        for mob in self.mobs:
            reached_end = self._move_mob(mob, dt)
            if reached_end:
                self.lives -= 1
            else:
                active_mobs.append(mob)
        self.mobs = active_mobs
        
        return self.get_broadcast_state()

    def _spawn_mob(self):
        start_node = self.pixel_path[0]
        self.mob_id_counter += 1
        new_mob = {
            'id': self.mob_id_counter,
            'hp': 100, 'max_hp': 100, 'speed': 300,
            'path_index': 0, 'x': start_node['x'], 'y': start_node['y']
        }
        self.mobs.append(new_mob)

    def _move_mob(self, mob, dt):
        if mob['path_index'] >= len(self.pixel_path) - 1: return True
        target = self.pixel_path[mob['path_index'] + 1]
        dx = target['x'] - mob['x']
        dy = target['y'] - mob['y']
        dist = math.sqrt(dx**2 + dy**2)
        move_dist = mob['speed'] * dt
        
        if move_dist >= dist:
            mob['x'] = target['x']
            mob['y'] = target['y']
            mob['path_index'] += 1
            if mob['path_index'] >= len(self.pixel_path) - 1: return True
        else:
            mob['x'] += (dx / dist) * move_dist
            mob['y'] += (dy / dist) * move_dist
        return False

    def process_command(self, command: dict):
        ctype = command.get('type')
        print(f"[Game {self.game_id}] Command received: {ctype}") # 로그 추가
        
        if ctype == 'SPAWN':
            return self._spawn_dice()
        
        elif ctype == 'MERGE':
            return self._handle_merge(command)
            
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

    # [수정] 결합 로직 (로그 추가)
    def _handle_merge(self, command):
        try:
            src_idx = command.get('source_index')
            tgt_idx = command.get('target_index')
            
            print(f"Merge Request: {src_idx} -> {tgt_idx}") # 로그

            if src_idx is None or tgt_idx is None: return None
            if src_idx == tgt_idx: return None
            if not (0 <= src_idx < len(self.grid)) or not (0 <= tgt_idx < len(self.grid)): return None

            src_cell = self.grid[src_idx]
            tgt_cell = self.grid[tgt_idx]
            
            src_dice = src_cell['dice']
            tgt_dice = tgt_cell['dice']
            
            if not src_dice or not tgt_dice:
                print("Merge Failed: One of dice is None")
                return None
            
            # 로직 가져오기
            logic = get_dice_logic(src_dice['id'])
            
            # 결합 가능 확인
            if logic.can_merge_with(src_dice, tgt_dice):
                print(f"Merging {src_dice['id']} Lv.{src_dice['level']}...") # 로그
                
                # 결합 실행
                new_dice_state = logic.on_merge(src_dice, tgt_dice, self.deck)
                
                # 그리드 반영
                self.grid[tgt_idx]['dice'] = new_dice_state
                self.grid[src_idx]['dice'] = None
                
                return True
            else:
                print("Merge Failed: Logic rejected (Different ID or Level)")
                
        except Exception as e:
            print(f"Merge Error: {e}")
            
        return None

    def get_broadcast_state(self):
        return {
            "type": "STATE_UPDATE",
            "sp": int(self.sp),
            "spawn_cost": self.spawn_cost,
            "lives": self.lives,
            "wave": self.wave,
            "grid": [cell['dice'] for cell in self.grid],
            "mobs": self.mobs
        }

    def get_initial_state(self):
        return {
            "type": "INIT",
            "game_id": self.game_id,
            "map": { "width": self.width, "height": self.height, "path": self.pixel_path, "grid": self.grid },
            "state": self.get_broadcast_state()
        }