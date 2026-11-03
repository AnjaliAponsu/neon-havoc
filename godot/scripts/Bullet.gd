extends Area2D
class_name Bullet

var velocity: Vector2 = Vector2.ZERO
var damage: float = 20.0
var pierce: int = 1
var pierced_count: int = 0
var max_range: float = 850.0
var distance_traveled: float = 0.0
var is_enemy: bool = false
var is_crit: bool = false

func setup(angle: float, spd: float, dmg: float, prc: int, crit: bool, enemy: bool) -> void:
	velocity = Vector2.RIGHT.rotated(angle) * spd
	damage = dmg
	pierce = prc
	is_crit = crit
	is_enemy = enemy

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _physics_process(dt: float) -> void:
	var step = velocity * dt
	global_position += step
	distance_traveled += step.length()
	if distance_traveled >= max_range:
		queue_free()
	queue_redraw()

func _on_body_entered(body: Node2D) -> void:
	if not is_enemy and body is Enemy:
		body.take_damage(damage, is_crit)
		pierced_count += 1
		if pierced_count >= pierce:
			queue_free()
	elif is_enemy and body is Player:
		body.take_damage(damage)
		queue_free()

func _draw() -> void:
	var col = Color("#ff3344") if is_enemy else (Color("#ffe600") if is_crit else Color("#00ffff"))
	draw_circle(Vector2.ZERO, 5.0, col)
	draw_circle(Vector2.ZERO, 2.5, Color.WHITE)

