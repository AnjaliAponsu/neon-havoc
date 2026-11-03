extends Node2D
class_name GameManager

var current_wave: int = 1
var run_time: float = 0.0
var target_time: float = 900.0 # 15 minutes
var save_path: String = "user://save_data.json"

var player: Player
var spawn_timer: float = 0.0
var boss_spawned: bool = false

func _ready() -> void:
	player = get_tree().get_first_node_in_group("player")
	_load_save_data()

func _process(dt: float) -> void:
	run_time += dt
	current_wave = min(20, int((run_time / target_time) * 20.0) + 1)

	# Wave 10 Boss Spawn
	if current_wave >= 10 and not boss_spawned:
		boss_spawned = true
		_spawn_boss()

func _spawn_boss() -> void:
	var boss_scene = load("res://scenes/Boss.tscn")
	if boss_scene and player:
		var boss = boss_scene.instantiate()
		boss.global_position = player.global_position + Vector2.RIGHT.rotated(randf() * TAU) * 600.0
		add_child(boss)

func _save_game_data(shards: int) -> void:
	var file = FileAccess.open(save_path, FileAccess.WRITE)
	if file:
		var dict = {
			"version": 1,
			"shards": shards,
			"timestamp": Time.get_datetime_string_from_system()
		}
		file.store_string(JSON.stringify(dict))

func _load_save_data() -> Dictionary:
	if not FileAccess.file_exists(save_path):
		return {}
	var file = FileAccess.open(save_path, FileAccess.READ)
	if file:
		var json = JSON.new()
		var err = json.parse(file.get_as_text())
		if err == OK and json.data is Dictionary:
			return json.data
	return {}

