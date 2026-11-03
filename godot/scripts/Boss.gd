extends CharacterBody2D
class_name VoidTitan

signal boss_defeated

@export var max_health: float = 3500.0
var health: float
var base_speed: float = 80.0
var color: Color = Color("#ff0044")
var radius: float = 65.0

var player: Player
var attack_timer: float = 0.0
var laser_angle: float = 0.0
var phase: int = 1

func _ready() -> void:
	add_to_group("enemies")
	add_to_group("boss")
	health = max_health

func _physics_process(dt: float) -> void:
	if not player:
		player = get_tree().get_first_node_in_group("player")
		if not player: return

	var to_player = player.global_position - global_position
	var dir = to_player.normalized()
	velocity = dir * base_speed
	move_and_slide()

	# Attacks
	attack_timer += dt
	if attack_timer >= 2.5:
		attack_timer = 0.0
		_fire_spiral_ring()

	queue_redraw()

func _fire_spiral_ring() -> void:
	var count = 16
	var bullet_scene = load("res://scenes/Bullet.tscn")
	if not bullet_scene: return

	for i in range(count):
		var angle = (i * TAU) / count + Time.get_ticks_msec() * 0.002
		var b = bullet_scene.instantiate()
		b.global_position = global_position
		b.setup(angle, 320.0, 18.0, 1, false, true)
		get_parent().add_child(b)

func take_damage(amount: float, _is_crit: bool = false) -> void:
	health -= amount
	if health <= 0:
		boss_defeated.emit()
		queue_free()

func _draw() -> void:
	# Spiky Void Boss Core
	draw_circle(Vector2.ZERO, radius + 8.0, Color(1, 0, 0.2, 0.3))
	draw_circle(Vector2.ZERO, radius, Color("#ff0044"))
	draw_circle(Vector2.ZERO, radius * 0.65, Color("#110011"))
	draw_circle(Vector2.ZERO, radius * 0.3, Color("#ff0044"))

