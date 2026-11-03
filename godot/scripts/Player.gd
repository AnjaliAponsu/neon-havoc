extends CharacterBody2D
class_name Player

# Spark-01 — Living Lightning Ball
signal health_changed(current, maximum)
signal shield_changed(current, maximum)
signal xp_changed(current, to_next, level)
signal leveled_up(level)
signal died

@export var base_speed: float = 320.0
@export var max_health: float = 100.0
@export var max_shield: float = 0.0

var health: float
var shield: float
var level: int = 1
var xp: int = 0
var xp_to_next: int = 50

# Combat Modifiers
var speed_mult: float = 1.0
var damage_mult: float = 1.0
var fire_rate_mult: float = 1.0
var extra_projectiles: int = 0
var extra_pierce: int = 0
var crit_chance: float = 0.08
var magnet_radius: float = 130.0

# Abilities
var dash_cooldown: float = 2.4
var dash_timer: float = 0.0
var is_dashing: bool = false
var dash_duration: float = 0.22
var dash_time_left: float = 0.0

var shield_active: bool = false
var shield_duration: float = 4.0
var shield_timer: float = 0.0
var shield_cooldown: float = 12.0
var shield_cd_timer: float = 0.0

var shockwave_cooldown: float = 8.0
var shockwave_cd_timer: float = 0.0

var overdrive_charge: float = 0.0
var is_overdrive: bool = false
var overdrive_timer: float = 0.0
var overdrive_duration: float = 6.0

# Weapon Timers
var fire_timer: float = 0.0
var base_fire_rate: float = 0.18
var bullet_scene = preload("res://scenes/Bullet.tscn")

func _ready() -> void:
	health = max_health
	shield = max_shield
	health_changed.emit(health, max_health)
	shield_changed.emit(shield, max_shield)
	xp_changed.emit(xp, xp_to_next, level)

func _physics_process(dt: float) -> void:
	_update_ability_cooldowns(dt)
	_handle_movement(dt)
	_handle_combat(dt)
	queue_redraw()

func _update_ability_cooldowns(dt: float) -> void:
	if dash_timer > 0: dash_timer -= dt
	if shield_cd_timer > 0: shield_cd_timer -= dt
	if shockwave_cd_timer > 0: shockwave_cd_timer -= dt

	if is_dashing:
		dash_time_left -= dt
		if dash_time_left <= 0:
			is_dashing = false

	if shield_active:
		shield_timer -= dt
		if shield_timer <= 0:
			shield_active = false

	if is_overdrive:
		overdrive_timer -= dt
		if overdrive_timer <= 0:
			is_overdrive = false
			overdrive_charge = 0.0

func _handle_movement(dt: float) -> void:
	if is_dashing:
		move_and_slide()
		return

	var input_vec = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var current_speed = base_speed * speed_mult * (1.45 if is_overdrive else 1.0)
	velocity = velocity.move_toward(input_vec * current_speed, current_speed * 12.0 * dt)
	move_and_slide()

	# Ability Triggers
	if Input.is_action_just_pressed("dash") and dash_timer <= 0:
		_trigger_dash(input_vec)

	if Input.is_action_just_pressed("shield") and shield_cd_timer <= 0:
		_trigger_shield()

	if Input.is_action_just_pressed("shockwave") and shockwave_cd_timer <= 0:
		_trigger_shockwave()

	if Input.is_action_just_pressed("overdrive") and overdrive_charge >= 100.0 and not is_overdrive:
		_trigger_overdrive()

func _trigger_dash(dir: Vector2) -> void:
	dash_timer = dash_cooldown
	is_dashing = true
	dash_time_left = dash_duration
	var dash_dir = dir.normalized() if dir != Vector2.ZERO else (get_global_mouse_position() - global_position).normalized()
	velocity = dash_dir * 950.0

func _trigger_shield() -> void:
	shield_cd_timer = shield_cooldown
	shield_active = true
	shield_timer = shield_duration

func _trigger_shockwave() -> void:
	shockwave_cd_timer = shockwave_cooldown
	var radius = 280.0
	var damage = 120.0 * damage_mult
	var enemies = get_tree().get_nodes_in_group("enemies")
	for e in enemies:
		if global_position.distance_to(e.global_position) <= radius:
			e.take_damage(damage, true)
			var push_dir = (e.global_position - global_position).normalized()
			e.apply_knockback(push_dir * 300.0)

func _trigger_overdrive() -> void:
	is_overdrive = true
	overdrive_timer = overdrive_duration

func _handle_combat(dt: float) -> void:
	fire_timer += dt
	var current_rate = base_fire_rate / fire_rate_mult
	if Input.is_action_pressed("shoot") and fire_timer >= current_rate:
		fire_timer = 0.0
		_shoot_primary()

func _shoot_primary() -> void:
	var mouse_pos = get_global_mouse_position()
	var base_angle = (mouse_pos - global_position).angle()
	var count = 1 + extra_projectiles
	var spread = 0.35 if count > 1 else 0.0
	var start_angle = base_angle - spread / 2.0
	var step = spread / (count - 1) if count > 1 else 0.0

	for i in range(count):
		var angle = base_angle if count == 1 else start_angle + i * step
		var is_crit = randf() < crit_chance
		var dmg = 22.0 * damage_mult * (2.5 if is_crit else 1.0)
		_spawn_bullet(global_position, angle, 750.0, dmg, 1 + extra_pierce, is_crit)

func _spawn_bullet(pos: Vector2, angle: float, spd: float, dmg: float, prc: int, crit: bool) -> void:
	if bullet_scene:
		var b = bullet_scene.instantiate()
		b.global_position = pos
		b.setup(angle, spd, dmg, prc, crit, false)
		get_parent().add_child(b)

func take_damage(amount: float) -> void:
	if is_dashing or shield_active or is_overdrive:
		return

	var rem = amount
	if shield > 0:
		if shield >= rem:
			shield -= rem
			rem = 0.0
		else:
			rem -= shield
			shield = 0.0
		shield_changed.emit(shield, max_shield)

	if rem > 0:
		health -= rem
		health_changed.emit(health, max_health)
		if health <= 0:
			died.emit()

func add_xp(val: int) -> void:
	xp += val
	if not is_overdrive:
		overdrive_charge = min(100.0, overdrive_charge + val * 0.18)

	while xp >= xp_to_next:
		xp -= xp_to_next
		level += 1
		xp_to_next = int(xp_to_next * 1.35 + 25)
		leveled_up.emit(level)

	xp_changed.emit(xp, xp_to_next, level)

func _draw() -> void:
	# Spark-01 Glow Sphere
	var col = Color("#ff0077") if is_overdrive else Color("#00f0ff")
	var r = 16.0 if is_overdrive else 11.0
	draw_circle(Vector2.ZERO, r + 4.0, Color(col.r, col.g, col.b, 0.35))
	draw_circle(Vector2.ZERO, r, col)
	draw_circle(Vector2.ZERO, r * 0.5, Color.WHITE)

	if shield_active:
		draw_arc(Vector2.ZERO, r + 14.0, 0, TAU, 32, Color("#00d4ff"), 3.0)

