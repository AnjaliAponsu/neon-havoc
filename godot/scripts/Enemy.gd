extends CharacterBody2D
class_name Enemy

enum Type { CHASER, SPEEDER, TANK, SPLITTER, SNIPER, EXPLODER }

@export var enemy_type: Type = Type.CHASER
var max_health: float = 25.0
var health: float
var base_speed: float = 160.0
var damage: float = 15.0
var xp_value: int = 10
var score_value: int = 100
var color: Color = Color("#ff2255")
var radius: float = 12.0
var knockback_resist: float = 0.0

var player: Player
var shoot_timer: float = 2.4
var is_aiming: bool = false
var aim_target: Vector2
var fuse_timer: float = 0.0
var is_exploding: bool = false

func _ready() -> void:
	add_to_group("enemies")
	_init_stats()
	health = max_health

func _init_stats() -> void:
	match enemy_type:
		Type.CHASER:
			color = Color("#ff2255")
			radius = 12.0
			base_speed = 160.0
			max_health = 25.0
			damage = 15.0
			xp_value = 10
		Type.SPEEDER:
			color = Color("#ffe600")
			radius = 9.0
			base_speed = 280.0
			max_health = 12.0
			damage = 10.0
			xp_value = 15
		Type.TANK:
			color = Color("#aa00ff")
			radius = 26.0
			base_speed = 75.0
			max_health = 180.0
			damage = 30.0
			xp_value = 45
			knockback_resist = 0.85
		Type.SPLITTER:
			color = Color("#00ff66")
			radius = 18.0
			base_speed = 120.0
			max_health = 45.0
			damage = 15.0
			xp_value = 20
		Type.SNIPER:
			color = Color("#0099ff")
			radius = 14.0
			base_speed = 95.0
			max_health = 35.0
			damage = 25.0
			xp_value = 30
		Type.EXPLODER:
			color = Color("#ff6600")
			radius = 15.0
			base_speed = 190.0
			max_health = 20.0
			damage = 40.0
			xp_value = 25

func _physics_process(dt: float) -> void:
	if not player:
		player = get_tree().get_first_node_in_group("player")
		if not player: return

	var to_player = player.global_position - global_position
	var dist = to_player.length()
	var dir = to_player.normalized()

	match enemy_type:
		Type.CHASER, Type.TANK, Type.SPLITTER:
			velocity = dir * base_speed
		Type.SPEEDER:
			var jitter = Vector2(-dir.y, dir.x) * sin(Time.get_ticks_msec() * 0.01) * 0.4
			velocity = (dir + jitter).normalized() * base_speed
		Type.SNIPER:
			if dist < 350.0:
				velocity = -dir * base_speed
			elif dist > 500.0:
				velocity = dir * base_speed
			else:
				velocity = Vector2(-dir.y, dir.x) * (base_speed * 0.6)
			_process_sniper(dt)
		Type.EXPLODER:
			if not is_exploding:
				velocity = dir * base_speed
				if dist < 110.0:
					is_exploding = true
					fuse_timer = 1.2
			else:
				velocity = dir * (base_speed * 1.35)
				fuse_timer -= dt
				if fuse_timer <= 0:
					_detonate()
					return

	move_and_slide()

	# Check contact with player
	if dist <= radius + 11.0:
		if player.is_overdrive:
			take_damage(999.0, true)
		else:
			player.take_damage(damage * dt * 2.0)

	queue_redraw()

func _process_sniper(dt: float) -> void:
	shoot_timer -= dt
	if shoot_timer <= 0.6 and not is_aiming:
		is_aiming = true
		aim_target = player.global_position

	if is_aiming:
		aim_target = aim_target.lerp(player.global_position, 0.1)

	if shoot_timer <= 0:
		shoot_timer = 2.4
		is_aiming = false
		var angle = (aim_target - global_position).angle()
		# Spawn sniper projectile
		var bullet_scene = load("res://scenes/Bullet.tscn")
		if bullet_scene:
			var b = bullet_scene.instantiate()
			b.global_position = global_position
			b.setup(angle, 680.0, 25.0, 1, false, true)
			get_parent().add_child(b)

func _detonate() -> void:
	if player and global_position.distance_to(player.global_position) <= 120.0:
		player.take_damage(damage)
	die()

func take_damage(amount: float, _is_crit: bool = false) -> void:
	health -= amount
	if health <= 0:
		die()

func apply_knockback(force: Vector2) -> void:
	velocity += force * (1.0 - knockback_resist)

func die() -> void:
	if player:
		player.add_xp(xp_value)
	queue_free()

func _draw() -> void:
	draw_circle(Vector2.ZERO, radius + 3.0, Color(color.r, color.g, color.b, 0.3))
	draw_circle(Vector2.ZERO, radius, color)
	# Angry eyes
	draw_circle(Vector2(-radius * 0.35, -2), radius * 0.18, Color.WHITE)
	draw_circle(Vector2(radius * 0.35, -2), radius * 0.18, Color.WHITE)

