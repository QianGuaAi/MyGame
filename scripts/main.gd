extends Node2D

const GAME_WIDTH := 960
const GAME_HEIGHT := 540
const PANEL_X := 758
const TOTAL_WAVES := 10

const PATH_POINTS := [
	Vector2(-56, 338),
	Vector2(124, 338),
	Vector2(124, 162),
	Vector2(292, 162),
	Vector2(292, 426),
	Vector2(474, 426),
	Vector2(474, 246),
	Vector2(626, 246),
	Vector2(626, 378),
	Vector2(742, 378),
]

const TOWER_SLOTS := [
	Vector2(86, 224),
	Vector2(96, 454),
	Vector2(214, 270),
	Vector2(222, 86),
	Vector2(360, 246),
	Vector2(352, 486),
	Vector2(430, 124),
	Vector2(546, 156),
	Vector2(548, 342),
	Vector2(686, 166),
	Vector2(684, 458),
	Vector2(694, 298),
]

const DECORATIONS := [
	["tree", Vector2(44, 88), 0.9],
	["tree", Vector2(162, 72), 0.78],
	["tree", Vector2(520, 62), 0.86],
	["tree", Vector2(700, 92), 0.72],
	["tree", Vector2(46, 486), 0.8],
	["tree", Vector2(594, 486), 0.84],
	["rock", Vector2(234, 352), 0.9],
	["rock", Vector2(406, 322), 0.7],
	["rock", Vector2(660, 510), 0.82],
	["shrub", Vector2(72, 146), 1.0],
	["shrub", Vector2(388, 72), 0.9],
	["shrub", Vector2(584, 188), 0.78],
	["shrub", Vector2(168, 504), 0.85],
]

const TOWER_TYPES := {
	"arrow": {
		"name": "哨箭塔",
		"price": 40,
		"range": 148.0,
		"damage": 16.0,
		"rate": 0.43,
		"projectile_speed": 560.0,
		"color": Color8(139, 90, 43),
		"accent": Color8(244, 210, 138),
		"description": "快速单体",
	},
	"mage": {
		"name": "秘法塔",
		"price": 70,
		"range": 132.0,
		"damage": 34.0,
		"rate": 0.78,
		"projectile_speed": 420.0,
		"slow_factor": 0.76,
		"slow_time": 0.45,
		"color": Color8(141, 92, 255),
		"accent": Color8(231, 215, 255),
		"description": "高伤穿甲",
	},
	"barracks": {
		"name": "卫兵营",
		"price": 60,
		"range": 104.0,
		"damage": 8.0,
		"rate": 0.28,
		"projectile_speed": 0.0,
		"slow_factor": 0.46,
		"slow_time": 0.25,
		"color": Color8(79, 139, 58),
		"accent": Color8(255, 223, 130),
		"description": "拦截牵制",
	},
	"artillery": {
		"name": "矮炮台",
		"price": 85,
		"range": 118.0,
		"damage": 48.0,
		"rate": 1.05,
		"projectile_speed": 350.0,
		"splash": 58.0,
		"color": Color8(93, 90, 82),
		"accent": Color8(255, 183, 77),
		"description": "范围爆破",
	},
}

var path_segments: Array = []
var path_length := 0.0

var gold := 160
var lives := 20
var wave := 0
var score := 0
var best_wave := 0

var enemies: Array = []
var towers: Array = []
var projectiles: Array = []
var effects: Array = []

var selected_build_type := "arrow"
var selected_tower = null
var wave_active := false
var game_ended := false
var victory := false
var spawned_this_wave := 0
var enemies_this_wave := 0
var spawn_timer := 0.0
var spawn_every := 0.82

var hero := {}
var hero_skill_cooldown := 0.0

var hud_label: Label
var title_label: Label
var selection_label: Label
var notice_label: Label
var start_button: Button
var upgrade_button: Button
var sell_button: Button
var hero_skill_button: Button
var restart_button: Button
var tower_buttons := {}


func _ready() -> void:
	randomize()
	_build_path_segments()
	_create_ui()
	_reset_game()


func _process(delta: float) -> void:
	if not game_ended:
		_update_spawning(delta)
		_update_enemies(delta)
		_update_towers(delta)
		_update_projectiles(delta)
		_update_hero(delta)
		_check_wave_complete()

	hero_skill_cooldown = maxf(hero_skill_cooldown - delta, 0.0)
	_update_effects(delta)
	_update_ui()
	queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if game_ended:
		return

	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_handle_map_click(event.position)


func _build_path_segments() -> void:
	path_segments.clear()
	path_length = 0.0

	for index in range(PATH_POINTS.size() - 1):
		var from_point: Vector2 = PATH_POINTS[index]
		var to_point: Vector2 = PATH_POINTS[index + 1]
		var length := from_point.distance_to(to_point)
		path_segments.append({
			"from": from_point,
			"to": to_point,
			"length": length,
			"start": path_length,
			"end": path_length + length,
			"angle": from_point.angle_to_point(to_point),
		})
		path_length += length


func _point_on_path(distance: float) -> Dictionary:
	var clamped: float = clampf(distance, 0.0, path_length)
	var segment: Dictionary = path_segments.back()

	for item in path_segments:
		if clamped <= item["end"]:
			segment = item
			break

	var segment_length: float = segment["length"]
	var t: float = 0.0 if is_zero_approx(segment_length) else (clamped - segment["start"]) / segment_length
	var from_point: Vector2 = segment["from"]
	var to_point: Vector2 = segment["to"]

	return {
		"position": from_point.lerp(to_point, t),
		"angle": segment["angle"],
	}


func _create_ui() -> void:
	hud_label = _make_label(Vector2(38, 23), 16, Color8(53, 36, 21))
	add_child(hud_label)

	title_label = _make_label(Vector2(PANEL_X + 24, 28), 25, Color8(74, 45, 23))
	title_label.text = "王冠前哨"
	add_child(title_label)

	start_button = _make_button(Vector2(PANEL_X + 24, 66), Vector2(154, 42), "开始", Color8(198, 76, 53), Color8(116, 48, 31), Color.WHITE)
	start_button.pressed.connect(_start_wave)
	add_child(start_button)

	var build_label := _make_label(Vector2(PANEL_X + 24, 122), 16, Color8(112, 69, 31))
	build_label.text = "建造"
	add_child(build_label)

	var keys := ["arrow", "mage", "barracks", "artillery"]
	for index in range(keys.size()):
		var key: String = keys[index]
		var tower: Dictionary = TOWER_TYPES[key]
		var button := _make_button(
			Vector2(PANEL_X + 24, 164 + index * 50),
			Vector2(154, 40),
			"%s  %d" % [tower["name"], tower["price"]],
			Color8(231, 201, 128),
			Color8(138, 90, 38),
			Color8(58, 40, 22)
		)
		button.pressed.connect(func() -> void: _select_build_type(key))
		tower_buttons[key] = button
		add_child(button)

	selection_label = _make_label(Vector2(PANEL_X + 25, 348), 15, Color8(60, 40, 20))
	selection_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	selection_label.size = Vector2(154, 98)
	selection_label.custom_minimum_size = Vector2(154, 98)
	add_child(selection_label)

	upgrade_button = _make_button(Vector2(PANEL_X + 24, 454), Vector2(154, 36), "升级", Color8(245, 184, 60), Color8(137, 80, 31), Color8(59, 37, 15))
	upgrade_button.pressed.connect(_upgrade_selected_tower)
	add_child(upgrade_button)

	sell_button = _make_button(Vector2(PANEL_X + 24, 498), Vector2(72, 34), "出售", Color8(143, 183, 107), Color8(76, 113, 53), Color8(24, 49, 17))
	sell_button.pressed.connect(_sell_selected_tower)
	add_child(sell_button)

	hero_skill_button = _make_button(Vector2(PANEL_X + 106, 498), Vector2(72, 34), "英雄技", Color8(105, 143, 203), Color8(42, 73, 119), Color.WHITE)
	hero_skill_button.pressed.connect(_cast_hero_skill)
	add_child(hero_skill_button)

	restart_button = _make_button(Vector2(GAME_WIDTH / 2 - 72, GAME_HEIGHT / 2 + 72), Vector2(144, 42), "重新开始", Color8(245, 184, 60), Color8(137, 80, 31), Color8(59, 37, 15))
	restart_button.pressed.connect(_reset_game)
	restart_button.visible = false
	add_child(restart_button)

	notice_label = _make_label(Vector2(290, 505), 18, Color8(109, 46, 24))
	notice_label.text = ""
	add_child(notice_label)


func _make_label(pos: Vector2, size: int, color: Color) -> Label:
	var label := Label.new()
	label.position = pos
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	return label


func _make_button(pos: Vector2, size: Vector2, text: String, fill: Color, border: Color, text_color: Color) -> Button:
	var button := Button.new()
	button.position = pos
	button.size = size
	button.text = text
	button.add_theme_font_size_override("font_size", 15)
	button.add_theme_color_override("font_color", text_color)
	button.add_theme_stylebox_override("normal", _button_style(fill, border))
	button.add_theme_stylebox_override("hover", _button_style(fill.lightened(0.1), border))
	button.add_theme_stylebox_override("pressed", _button_style(fill.darkened(0.08), border))
	button.add_theme_stylebox_override("disabled", _button_style(fill.darkened(0.25), border.darkened(0.2)))
	return button


func _button_style(fill: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(3)
	style.corner_radius_top_left = 2
	style.corner_radius_top_right = 2
	style.corner_radius_bottom_left = 2
	style.corner_radius_bottom_right = 2
	return style


func _reset_game() -> void:
	gold = 160
	lives = 20
	wave = 0
	score = 0
	best_wave = max(best_wave, 0)
	enemies.clear()
	towers.clear()
	projectiles.clear()
	effects.clear()
	selected_build_type = "arrow"
	selected_tower = null
	wave_active = false
	game_ended = false
	victory = false
	spawned_this_wave = 0
	enemies_this_wave = 0
	spawn_timer = 0.0
	spawn_every = 0.82
	hero = {
		"position": Vector2(690, 404),
		"home": Vector2(690, 404),
		"range": 118.0,
		"damage": 12.0,
		"rate": 0.55,
		"cooldown": 0.0,
		"target": null,
	}
	hero_skill_cooldown = 0.0
	restart_button.visible = false
	_update_ui()
	queue_redraw()


func _start_wave() -> void:
	if wave_active or game_ended or wave >= TOTAL_WAVES:
		return

	wave += 1
	wave_active = true
	spawned_this_wave = 0
	enemies_this_wave = _get_wave_enemy_total(wave)
	spawn_every = maxf(0.41, 0.86 - wave * 0.032)
	spawn_timer = 0.45
	_show_notice("第 %d/%d 波来袭" % [wave, TOTAL_WAVES], Color8(122, 61, 18))
	_update_ui()


func _get_wave_enemy_total(wave_number: int) -> int:
	return 9 + wave_number * 3


func _update_spawning(delta: float) -> void:
	if not wave_active or spawned_this_wave >= enemies_this_wave:
		return

	spawn_timer -= delta
	if spawn_timer > 0.0:
		return

	var heavy := wave >= 2 and (spawned_this_wave % 6 == 5 or spawned_this_wave == enemies_this_wave - 1)
	_spawn_enemy(heavy)
	spawned_this_wave += 1
	spawn_timer = spawn_every


func _spawn_enemy(heavy: bool) -> void:
	var wave_scale := wave - 1
	var max_hp: float = float((145 if heavy else 50) + wave_scale * (50 if heavy else 23))
	var reward: int = (28 + wave * 4) if heavy else (8 + int(ceil(wave * 1.5)))
	var path_point := _point_on_path(0.0)

	enemies.append({
		"position": path_point["position"],
		"angle": path_point["angle"],
		"progress": 0.0,
		"max_hp": max_hp,
		"hp": max_hp,
		"speed": (43.0 + minf(18.0, wave * 2.0)) if heavy else (62.0 + minf(28.0, wave * 3.0)),
		"reward": reward,
		"heavy": heavy,
		"slow_time": 0.0,
		"slow_factor": 1.0,
	})


func _update_enemies(delta: float) -> void:
	for enemy in enemies.duplicate():
		enemy["slow_time"] = maxf(enemy["slow_time"] - delta, 0.0)
		var speed: float = enemy["speed"] * (enemy["slow_factor"] if enemy["slow_time"] > 0.0 else 1.0)
		enemy["progress"] += speed * delta

		if enemy["progress"] >= path_length:
			_enemy_escaped(enemy)
			continue

		var path_point := _point_on_path(enemy["progress"])
		enemy["position"] = path_point["position"]
		enemy["angle"] = path_point["angle"]


func _update_towers(delta: float) -> void:
	for tower in towers:
		tower["cooldown"] = maxf(tower["cooldown"] - delta, 0.0)
		var target = _find_target_for_tower(tower)

		if tower["type_key"] == "barracks":
			_update_barracks(tower, target, delta)
			continue

		if target == null or tower["cooldown"] > 0.0:
			continue

		_fire_tower(tower, target)
		tower["cooldown"] = tower["rate"]


func _update_barracks(tower: Dictionary, target, delta: float) -> void:
	if target == null:
		return

	if tower["cooldown"] > 0.0:
		return

	_damage_enemy(target, tower["damage"] * 2.0, tower)
	target["slow_time"] = maxf(target["slow_time"], tower["slow_time"])
	target["slow_factor"] = minf(target["slow_factor"], tower["slow_factor"])
	tower["cooldown"] = tower["rate"]


func _find_target_for_tower(tower: Dictionary):
	var target = null
	var best_progress := -1.0
	var tower_pos: Vector2 = tower["position"]

	for enemy in enemies:
		var enemy_pos: Vector2 = enemy["position"]
		if tower_pos.distance_to(enemy_pos) <= tower["range"] and enemy["progress"] > best_progress:
			best_progress = enemy["progress"]
			target = enemy

	return target


func _fire_tower(tower: Dictionary, target: Dictionary) -> void:
	var tower_type: Dictionary = TOWER_TYPES[tower["type_key"]]
	projectiles.append({
		"position": tower["position"] + Vector2(0, -18),
		"target": target,
		"damage": tower["damage"],
		"speed": tower["projectile_speed"],
		"splash": tower.get("splash", 0.0),
		"slow_factor": tower.get("slow_factor", 1.0),
		"slow_time": tower.get("slow_time", 0.0),
		"type_key": tower["type_key"],
		"color": tower_type["color"],
	})


func _update_projectiles(delta: float) -> void:
	for projectile in projectiles.duplicate():
		var target = projectile["target"]

		if not enemies.has(target):
			projectiles.erase(projectile)
			continue

		var position: Vector2 = projectile["position"]
		var target_pos: Vector2 = target["position"]
		var distance := position.distance_to(target_pos)
		var travel: float = projectile["speed"] * delta

		if distance <= travel:
			_impact_projectile(projectile, target_pos)
			projectiles.erase(projectile)
			continue

		projectile["position"] = position.move_toward(target_pos, travel)


func _impact_projectile(projectile: Dictionary, position: Vector2) -> void:
	var splash: float = projectile.get("splash", 0.0)

	if splash > 0.0:
		effects.append({"type": "blast", "position": position, "radius": splash, "ttl": 0.22, "max_ttl": 0.22, "color": Color8(245, 184, 60)})
		for enemy in enemies.duplicate():
			var enemy_pos: Vector2 = enemy["position"]
			var distance := position.distance_to(enemy_pos)
			if distance <= splash:
				var falloff := clampf(1.0 - distance / (splash * 1.6), 0.42, 1.0)
				_damage_enemy(enemy, projectile["damage"] * falloff, projectile)
		return

	_damage_enemy(projectile["target"], projectile["damage"], projectile)


func _damage_enemy(enemy: Dictionary, amount: float, source: Dictionary) -> void:
	if not enemies.has(enemy):
		return

	enemy["hp"] -= amount

	if source.get("slow_time", 0.0) > 0.0:
		enemy["slow_time"] = maxf(enemy["slow_time"], source["slow_time"])
		enemy["slow_factor"] = minf(enemy["slow_factor"], source.get("slow_factor", 1.0))

	if enemy["hp"] <= 0.0:
		_destroy_enemy(enemy, true)


func _enemy_escaped(enemy: Dictionary) -> void:
	_destroy_enemy(enemy, false)
	lives -= 2 if enemy["heavy"] else 1
	_show_notice("怪兽突破防线", Color8(156, 43, 36))

	if lives <= 0:
		_finish_defeat()


func _destroy_enemy(enemy: Dictionary, rewarded: bool) -> void:
	if not enemies.has(enemy):
		return

	enemies.erase(enemy)

	if rewarded:
		gold += enemy["reward"]
		score += enemy["reward"] * 5


func _update_hero(delta: float) -> void:
	hero["cooldown"] = maxf(hero["cooldown"] - delta, 0.0)
	var target = _find_hero_target()
	var home: Vector2 = hero["home"]
	var pos: Vector2 = hero["position"]

	if target != null:
		var target_pos: Vector2 = target["position"]
		hero["position"] = pos.move_toward(target_pos + Vector2(20, 20), 130.0 * delta)

		if hero["position"].distance_to(target_pos) <= 42.0 and hero["cooldown"] <= 0.0:
			_damage_enemy(target, hero["damage"], {"slow_time": 0.18, "slow_factor": 0.72})
			hero["cooldown"] = hero["rate"]
	else:
		hero["position"] = pos.move_toward(home, 90.0 * delta)


func _find_hero_target():
	var target = null
	var best_progress := -1.0
	var hero_pos: Vector2 = hero["position"]

	for enemy in enemies:
		var enemy_pos: Vector2 = enemy["position"]
		if hero_pos.distance_to(enemy_pos) <= hero["range"] and enemy["progress"] > best_progress:
			best_progress = enemy["progress"]
			target = enemy

	return target


func _cast_hero_skill() -> void:
	if hero_skill_cooldown > 0.0 or game_ended:
		return

	var center := Vector2(390, 300)
	var most_advanced = null
	var best_progress := -1.0

	for enemy in enemies:
		if enemy["progress"] > best_progress:
			best_progress = enemy["progress"]
			most_advanced = enemy

	if most_advanced != null:
		center = most_advanced["position"]

	effects.append({"type": "hero_skill", "position": center, "radius": 170.0, "ttl": 0.55, "max_ttl": 0.55, "color": Color8(105, 143, 203)})

	for enemy in enemies.duplicate():
		var enemy_pos: Vector2 = enemy["position"]
		if center.distance_to(enemy_pos) <= 170.0:
			_damage_enemy(enemy, 78.0 + wave * 6.0, {"slow_time": 1.1, "slow_factor": 0.5})

	hero_skill_cooldown = 16.0
	_show_notice("英雄技能：王冠轰击", Color8(42, 73, 119))


func _update_effects(delta: float) -> void:
	for effect in effects.duplicate():
		effect["ttl"] -= delta
		if effect["ttl"] <= 0.0:
			effects.erase(effect)


func _check_wave_complete() -> void:
	if not wave_active:
		return

	if spawned_this_wave < enemies_this_wave or enemies.size() > 0:
		return

	var bonus := 24 + wave * 5
	wave_active = false
	gold += bonus
	best_wave = max(best_wave, wave)

	if wave >= TOTAL_WAVES:
		_finish_victory()
		return

	_show_notice("守住第 %d 波  +%d" % [wave, bonus], Color8(49, 92, 34))


func _finish_defeat() -> void:
	game_ended = true
	wave_active = false
	victory = false
	restart_button.visible = true
	_show_notice("前哨失守", Color8(156, 43, 36))


func _finish_victory() -> void:
	game_ended = true
	wave_active = false
	victory = true
	best_wave = TOTAL_WAVES
	restart_button.visible = true
	_show_notice("所有怪兽波次已清空", Color8(49, 92, 34))


func _select_build_type(key: String) -> void:
	selected_build_type = key
	selected_tower = null
	_update_ui()


func _handle_map_click(pos: Vector2) -> void:
	if pos.x >= PANEL_X:
		return

	for tower in towers:
		var tower_pos: Vector2 = tower["position"]
		if tower_pos.distance_to(pos) <= 34.0:
			selected_tower = tower
			_update_ui()
			return

	for index in range(TOWER_SLOTS.size()):
		var slot: Vector2 = TOWER_SLOTS[index]
		if slot.distance_to(pos) <= 30.0:
			var existing = _tower_at_slot(index)
			if existing != null:
				selected_tower = existing
				_update_ui()
			else:
				_build_tower(index)
			return


func _tower_at_slot(slot_index: int):
	for tower in towers:
		if tower["slot"] == slot_index:
			return tower
	return null


func _build_tower(slot_index: int) -> void:
	var tower_type: Dictionary = TOWER_TYPES[selected_build_type]

	if gold < tower_type["price"]:
		_show_notice("金币不足", Color8(156, 43, 36))
		return

	gold -= tower_type["price"]
	var tower := {
		"slot": slot_index,
		"type_key": selected_build_type,
		"level": 1,
		"position": TOWER_SLOTS[slot_index],
		"total_cost": tower_type["price"],
		"cooldown": 0.0,
	}
	_apply_tower_stats(tower)
	towers.append(tower)
	selected_tower = tower
	_show_notice("%s 已部署" % tower_type["name"], Color8(49, 92, 34))
	_update_ui()


func _apply_tower_stats(tower: Dictionary) -> void:
	var tower_type: Dictionary = TOWER_TYPES[tower["type_key"]]
	var level_bonus: int = tower["level"] - 1
	tower["range"] = tower_type["range"] + level_bonus * 16.0
	tower["damage"] = tower_type["damage"] * (1.0 + level_bonus * 0.4)
	tower["rate"] = maxf(0.22, tower_type["rate"] * (1.0 - level_bonus * 0.1))
	tower["projectile_speed"] = tower_type["projectile_speed"]
	tower["splash"] = tower_type.get("splash", 0.0)
	tower["slow_factor"] = tower_type.get("slow_factor", 1.0)
	tower["slow_time"] = tower_type.get("slow_time", 0.0)


func _upgrade_selected_tower() -> void:
	if selected_tower == null or selected_tower["level"] >= 3:
		return

	var cost := _get_upgrade_cost(selected_tower)
	if gold < cost:
		_show_notice("金币不足", Color8(156, 43, 36))
		return

	gold -= cost
	selected_tower["level"] += 1
	selected_tower["total_cost"] += cost
	_apply_tower_stats(selected_tower)
	_show_notice("%s Lv.%d" % [TOWER_TYPES[selected_tower["type_key"]]["name"], selected_tower["level"]], Color8(122, 61, 18))
	_update_ui()


func _sell_selected_tower() -> void:
	if selected_tower == null:
		return

	var refund := int(floor(selected_tower["total_cost"] * 0.55))
	gold += refund
	towers.erase(selected_tower)
	selected_tower = null
	_show_notice("回收 +%d" % refund, Color8(49, 92, 34))
	_update_ui()


func _get_upgrade_cost(tower: Dictionary) -> int:
	var tower_type: Dictionary = TOWER_TYPES[tower["type_key"]]
	return int(round(tower_type["price"] * (0.8 + tower["level"] * 0.58)))


func _show_notice(text: String, color: Color) -> void:
	notice_label.text = text
	notice_label.add_theme_color_override("font_color", color)


func _update_ui() -> void:
	var remaining_enemies: int = _get_remaining_enemies_in_wave()
	var waves_left: int = max(TOTAL_WAVES - wave, 0)
	var wave_label: String = "%d/%d" % [wave, TOTAL_WAVES]

	hud_label.text = "金币 %d  生命 %d  第 %s 波  还剩 %d 波  敌人还剩 %d  得分 %d" % [
		gold,
		max(lives, 0),
		wave_label,
		waves_left,
		remaining_enemies,
		score,
	]

	if wave >= TOTAL_WAVES and not wave_active:
		start_button.text = "波次已完成"
	else:
		start_button.text = "第 %d/%d 波中" % [wave, TOTAL_WAVES] if wave_active else "开始第 %d/%d 波" % [wave + 1, TOTAL_WAVES]
	start_button.disabled = wave_active or game_ended or wave >= TOTAL_WAVES

	for key in tower_buttons:
		var button: Button = tower_buttons[key]
		var tower_type: Dictionary = TOWER_TYPES[key]
		button.text = "%s  %d" % [tower_type["name"], tower_type["price"]]
		button.modulate = Color(1, 1, 1, 1) if key == selected_build_type and selected_tower == null else Color(0.92, 0.92, 0.92, 1)

	if selected_tower == null:
		var selected_type: Dictionary = TOWER_TYPES[selected_build_type]
		selection_label.text = "%s\n%s\n花费 %d\n伤害 %d\n射程 %d\n攻速 %.1f/秒" % [
			selected_type["name"],
			selected_type["description"],
			selected_type["price"],
			int(selected_type["damage"]),
			int(selected_type["range"]),
			1.0 / selected_type["rate"],
		]
		upgrade_button.visible = false
		sell_button.visible = false
	else:
		var current_type: Dictionary = TOWER_TYPES[selected_tower["type_key"]]
		selection_label.text = "%s Lv.%d\n%s\n伤害 %d\n射程 %d\n攻速 %.1f/秒" % [
			current_type["name"],
			selected_tower["level"],
			current_type["description"],
			int(selected_tower["damage"]),
			int(selected_tower["range"]),
			1.0 / selected_tower["rate"],
		]
		upgrade_button.visible = true
		sell_button.visible = true
		upgrade_button.text = "已满级" if selected_tower["level"] >= 3 else "升级 %d" % _get_upgrade_cost(selected_tower)
		upgrade_button.disabled = selected_tower["level"] >= 3
		sell_button.text = "出售 +%d" % int(floor(selected_tower["total_cost"] * 0.55))

	hero_skill_button.text = "冷却 %ds" % int(ceil(hero_skill_cooldown)) if hero_skill_cooldown > 0.0 else "英雄技"
	hero_skill_button.disabled = hero_skill_cooldown > 0.0 or game_ended


func _get_remaining_enemies_in_wave() -> int:
	if not wave_active:
		return 0
	return enemies.size() + max(enemies_this_wave - spawned_this_wave, 0)


func _draw() -> void:
	_draw_map()
	_draw_slots()
	_draw_towers()
	_draw_enemies()
	_draw_projectiles()
	_draw_hero()
	_draw_effects()
	_draw_panel()
	_draw_end_overlay()


func _draw_map() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(GAME_WIDTH, GAME_HEIGHT)), Color8(135, 184, 102))
	draw_rect(Rect2(Vector2.ZERO, Vector2(PANEL_X, GAME_HEIGHT)), Color8(155, 207, 115, 175))

	for x in range(0, PANEL_X, 48):
		draw_line(Vector2(x, 0), Vector2(x, GAME_HEIGHT), Color8(106, 159, 75, 38), 1.0)
	for y in range(0, GAME_HEIGHT, 48):
		draw_line(Vector2(0, y), Vector2(PANEL_X, y), Color8(106, 159, 75, 38), 1.0)

	for item in DECORATIONS:
		var kind: String = item[0]
		var pos: Vector2 = item[1]
		var scale: float = item[2]
		if kind == "tree":
			_draw_tree(pos, scale)
		elif kind == "rock":
			_draw_rock(pos, scale)
		else:
			_draw_shrub(pos, scale)

	_draw_path()
	_draw_base()


func _draw_path() -> void:
	var points := PackedVector2Array(PATH_POINTS)
	for width_color in [
		[70.0, Color8(76, 55, 32, 115)],
		[56.0, Color8(138, 98, 48)],
		[44.0, Color8(201, 150, 75)],
		[4.0, Color8(246, 207, 116, 165)],
	]:
		draw_polyline(points, width_color[1], width_color[0], true)
		for point in PATH_POINTS:
			draw_circle(point, width_color[0] / 2.0, width_color[1])


func _draw_base() -> void:
	draw_circle(Vector2(22, 338), 26, Color8(244, 197, 66))
	draw_arc(Vector2(22, 338), 26, 0, TAU, 48, Color8(122, 75, 37), 4.0)
	draw_rect(Rect2(Vector2(724, 350), Vector2(34, 86)), Color8(139, 90, 43))
	draw_rect(Rect2(Vector2(716, 350), Vector2(50, 24)), Color8(180, 59, 47))
	draw_rect(Rect2(Vector2(735, 386), Vector2(12, 48)), Color8(79, 47, 24))


func _draw_slots() -> void:
	for index in range(TOWER_SLOTS.size()):
		var slot: Vector2 = TOWER_SLOTS[index]
		var occupied: bool = _tower_at_slot(index) != null
		draw_circle(slot, 26, Color8(185, 177, 156, 145 if occupied else 255))
		draw_arc(slot, 26, 0, TAU, 48, Color8(106, 90, 70), 4.0)
		if not occupied:
			draw_circle(slot, 17, Color8(120, 107, 86, 150))
			draw_line(slot + Vector2(-8, 0), slot + Vector2(8, 0), Color8(248, 237, 199), 3.0)
			draw_line(slot + Vector2(0, -8), slot + Vector2(0, 8), Color8(248, 237, 199), 3.0)


func _draw_towers() -> void:
	for tower in towers:
		var pos: Vector2 = tower["position"]
		var tower_type: Dictionary = TOWER_TYPES[tower["type_key"]]
		draw_circle(pos + Vector2(0, 19), 18, Color8(47, 36, 21, 55))

		if selected_tower == tower:
			var range_color: Color = tower_type["color"]
			range_color.a = 0.45
			draw_arc(pos, tower["range"], 0, TAU, 96, range_color, 3.0)

		match tower["type_key"]:
			"arrow":
				_draw_arrow_tower(pos, tower["level"])
			"mage":
				_draw_mage_tower(pos, tower["level"])
			"barracks":
				_draw_barracks(pos, tower["level"])
			"artillery":
				_draw_artillery(pos, tower["level"])


func _draw_arrow_tower(pos: Vector2, level: int) -> void:
	draw_rect(Rect2(pos + Vector2(-16, -2), Vector2(32, 30)), Color8(111, 69, 34))
	draw_polygon(PackedVector2Array([pos + Vector2(-22, 0), pos + Vector2(0, -25), pos + Vector2(22, 0)]), PackedColorArray([Color8(182, 109, 49), Color8(182, 109, 49), Color8(182, 109, 49)]))
	draw_line(pos + Vector2(-10, 7), pos + Vector2(10, 7), Color8(244, 210, 138), 3.0)
	_draw_level_badge(pos, level)


func _draw_mage_tower(pos: Vector2, level: int) -> void:
	draw_rect(Rect2(pos + Vector2(-15, -2), Vector2(30, 30)), Color8(111, 110, 134))
	draw_polygon(PackedVector2Array([pos + Vector2(0, -27), pos + Vector2(-18, 2), pos + Vector2(18, 2)]), PackedColorArray([Color8(141, 92, 255), Color8(141, 92, 255), Color8(141, 92, 255)]))
	draw_circle(pos + Vector2(0, -9), 7 + level, Color8(231, 215, 255))
	_draw_level_badge(pos, level)


func _draw_barracks(pos: Vector2, level: int) -> void:
	draw_rect(Rect2(pos + Vector2(-22, -1), Vector2(44, 30)), Color8(123, 86, 52))
	draw_polygon(PackedVector2Array([pos + Vector2(-25, 0), pos + Vector2(0, -24), pos + Vector2(25, 0)]), PackedColorArray([Color8(79, 139, 58), Color8(79, 139, 58), Color8(79, 139, 58)]))
	draw_rect(Rect2(pos + Vector2(-5, 12), Vector2(10, 17)), Color8(214, 163, 90))
	_draw_guard(pos + Vector2(-18, 22), false)
	_draw_guard(pos + Vector2(18, 22), true)
	_draw_level_badge(pos, level)


func _draw_artillery(pos: Vector2, level: int) -> void:
	draw_rect(Rect2(pos + Vector2(-17, 4), Vector2(34, 24)), Color8(93, 90, 82))
	draw_circle(pos + Vector2(0, -1), 17, Color8(55, 56, 51))
	draw_line(pos + Vector2(6, -8), pos + Vector2(25, -15), Color8(36, 38, 32), 9.0)
	draw_circle(pos + Vector2(19, -13), 5 + level, Color8(255, 183, 77))
	_draw_level_badge(pos, level)


func _draw_level_badge(pos: Vector2, level: int) -> void:
	draw_rect(Rect2(pos + Vector2(16, 17), Vector2(17, 17)), Color8(110, 62, 30))
	draw_string(ThemeDB.fallback_font, pos + Vector2(20, 31), ["I", "II", "III"][level - 1], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color8(255, 246, 216))


func _draw_enemies() -> void:
	for enemy in enemies:
		var pos: Vector2 = enemy["position"]
		var body: Color = Color8(156, 120, 82) if enemy["heavy"] else Color8(120, 169, 72)
		if enemy["slow_time"] > 0.0:
			body = body.lerp(Color8(184, 217, 255), 0.45)

		draw_circle(pos, 18 if enemy["heavy"] else 14, body)
		draw_circle(pos + Vector2(12, -6), 10 if enemy["heavy"] else 8, body.lightened(0.16))
		draw_circle(pos + Vector2(17, -8), 2, Color8(43, 33, 24))
		draw_line(pos + Vector2(-7, 14), pos + Vector2(-9, 24), Color8(75, 54, 41), 4.0)
		draw_line(pos + Vector2(7, 14), pos + Vector2(7, 24), Color8(75, 54, 41), 4.0)

		var width: float = 40.0 if enemy["heavy"] else 32.0
		var health_ratio := clampf(enemy["hp"] / enemy["max_hp"], 0.0, 1.0)
		draw_rect(Rect2(pos + Vector2(-width / 2.0, -31), Vector2(width, 5)), Color8(59, 36, 21))
		draw_rect(Rect2(pos + Vector2(-width / 2.0, -31), Vector2(width * health_ratio, 5)), Color8(214, 66, 42))


func _draw_projectiles() -> void:
	for projectile in projectiles:
		var pos: Vector2 = projectile["position"]
		var color: Color = projectile["color"]
		if projectile["type_key"] == "arrow":
			var target = projectile["target"]
			var target_pos: Vector2 = target["position"] if enemies.has(target) else pos + Vector2.RIGHT
			var dir := pos.direction_to(target_pos)
			draw_line(pos - dir * 10.0, pos + dir * 14.0, Color8(241, 208, 138), 4.0)
			draw_circle(pos + dir * 15.0, 4, Color8(122, 74, 33))
		else:
			draw_circle(pos, 7 if projectile.get("splash", 0.0) > 0.0 else 6, color)
			draw_arc(pos, 7 if projectile.get("splash", 0.0) > 0.0 else 6, 0, TAU, 24, Color.WHITE, 1.5)


func _draw_hero() -> void:
	var pos: Vector2 = hero.get("position", Vector2(690, 404))
	draw_arc(pos, hero.get("range", 118.0), 0, TAU, 64, Color8(66, 100, 159, 80), 2.0)
	draw_circle(pos, 16, Color8(36, 73, 114))
	draw_circle(pos + Vector2(0, -15), 8, Color8(241, 194, 125))
	draw_rect(Rect2(pos + Vector2(-12, -4), Vector2(8, 16)), Color8(200, 211, 218))
	draw_line(pos + Vector2(14, -2), pos + Vector2(30, -18), Color8(95, 60, 32), 4.0)


func _draw_effects() -> void:
	for effect in effects:
		var ttl: float = effect["ttl"]
		var max_ttl: float = effect["max_ttl"]
		var t := clampf(ttl / max_ttl, 0.0, 1.0)
		var color: Color = effect["color"]
		color.a = 0.26 * t
		draw_circle(effect["position"], effect["radius"] * (1.15 - t * 0.15), color)
		color.a = 0.46 * t
		draw_arc(effect["position"], effect["radius"] * (1.15 - t * 0.15), 0, TAU, 96, color, 3.0)


func _draw_panel() -> void:
	draw_rect(Rect2(Vector2(PANEL_X, 0), Vector2(GAME_WIDTH - PANEL_X, GAME_HEIGHT)), Color8(234, 211, 154))
	draw_rect(Rect2(Vector2(PANEL_X + 10, 12), Vector2(184, GAME_HEIGHT - 24)), Color8(246, 226, 169))
	draw_rect(Rect2(Vector2(PANEL_X + 10, 12), Vector2(184, GAME_HEIGHT - 24)), Color8(122, 75, 37), false, 4.0)
	draw_rect(Rect2(Vector2(20, 14), Vector2(714, 42)), Color8(246, 226, 169, 238))
	draw_rect(Rect2(Vector2(20, 14), Vector2(714, 42)), Color8(122, 75, 37), false, 3.0)

	for key in tower_buttons:
		var button: Button = tower_buttons[key]
		var tower_type: Dictionary = TOWER_TYPES[key]
		draw_circle(button.position + Vector2(16, 21), 8, tower_type["color"])


func _draw_end_overlay() -> void:
	if not game_ended:
		return

	draw_rect(Rect2(Vector2.ZERO, Vector2(GAME_WIDTH, GAME_HEIGHT)), Color8(32, 21, 13, 165))
	var text: String = "前哨守住了\n完成 %d/%d 波\n得分 %d" % [TOTAL_WAVES, TOTAL_WAVES, score] if victory else "前哨失守\n坚持到第 %d 波\n得分 %d" % [wave, score]
	var lines := text.split("\n")
	for index in range(lines.size()):
		draw_string(ThemeDB.fallback_font, Vector2(GAME_WIDTH / 2 - 95, GAME_HEIGHT / 2 - 54 + index * 32), lines[index], HORIZONTAL_ALIGNMENT_LEFT, 220, 28, Color8(255, 246, 216))


func _draw_tree(pos: Vector2, scale: float) -> void:
	draw_rect(Rect2(pos + Vector2(-4, 10) * scale, Vector2(9, 22) * scale), Color8(121, 80, 50))
	draw_circle(pos + Vector2(-10, 4) * scale, 16 * scale, Color8(47, 107, 52))
	draw_circle(pos + Vector2(10, 2) * scale, 18 * scale, Color8(47, 107, 52))
	draw_circle(pos + Vector2(0, -12) * scale, 17 * scale, Color8(47, 107, 52))


func _draw_rock(pos: Vector2, scale: float) -> void:
	draw_circle(pos, 16 * scale, Color8(140, 138, 126))
	draw_circle(pos + Vector2(-7, -5) * scale, 7 * scale, Color8(185, 181, 166))


func _draw_shrub(pos: Vector2, scale: float) -> void:
	draw_circle(pos + Vector2(-10, 4) * scale, 10 * scale, Color8(95, 155, 72))
	draw_circle(pos + Vector2(2, 0) * scale, 12 * scale, Color8(95, 155, 72))
	draw_circle(pos + Vector2(14, 6) * scale, 10 * scale, Color8(95, 155, 72))
	draw_circle(pos + Vector2(3, -3) * scale, 2 * scale, Color8(255, 209, 102))


func _draw_guard(pos: Vector2, flip: bool) -> void:
	var dir: float = -1.0 if flip else 1.0
	draw_circle(pos + Vector2(0, -12), 6, Color8(241, 194, 125))
	draw_rect(Rect2(pos + Vector2(-6, -7), Vector2(12, 17)), Color8(36, 73, 114))
	draw_line(pos + Vector2(8 * dir, -2), pos + Vector2(22 * dir, -12), Color8(95, 60, 32), 3.0)
