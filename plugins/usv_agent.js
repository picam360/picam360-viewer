var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;
	var m_forward_button = null;
	var m_way_points = [];

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var USVC_DOMAIN = UPSTREAM_DOMAIN + "usvc.";
	var MOVE_TIMEOUT = 60 * 1000;// 1min

	var FORWARD_ICON = "data:image/png;base64,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";
	var FORWARD_PUSHED_ICON = "data:image/png;base64,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";

	function create_forward_button(plugin) {
		var button = document.createElement("img");
		button.src = FORWARD_ICON;
		button.down = false;
		var mousedownFunc = function(ev) {
			plugin.event_handler_act("MOVE");

			button.down = true;

			button.src = FORWARD_PUSHED_ICON;
		}
		button.mouseupFunc = function() {
			plugin.event_handler_act("STOP");

			button.down = false;

			button.src = FORWARD_ICON;
		}
		var preventFunc = function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}
		button.addEventListener("touchstart", mousedownFunc);
		button.addEventListener("mousedown", mousedownFunc);
		button.addEventListener("dragstart", preventFunc);

		return button;
	}
	function init(plugin) {
		m_foward_button = create_forward_button(plugin);
		m_foward_button.style.position = 'absolute';
		m_foward_button.width = 50;
		m_foward_button.height = 50;
		m_foward_button
			.setAttribute("style", "position:absolute; bottom:33%; right:10%;");

		var mouseupFunc = function(ev) {
			if (m_foward_button.down) {
				m_foward_button.mouseupFunc(ev);
			}
		}
		var mousemoveFunc = function(ev) {
		}
		document.addEventListener("touchend", mouseupFunc);
		document.addEventListener("mouseup", mouseupFunc);
		document.addEventListener("touchmove", mousemoveFunc, true);
		document.addEventListener("mousemove", mousemoveFunc, true);

		document.body.appendChild(m_foward_button);

		m_plugin_host.add_watch(USVC_DOMAIN + "way_points", function(ret) {
			m_way_points = ret;
		});

		var map_plugin = m_plugin_host.get_plugin("map");
		map_plugin.set_post_map_loaded(function(map) {
			var featureLine = new ol.Feature({
				geometry : new ol.geom.LineString([])
			});
			var sourceLine = new ol.source.Vector({
				features : [featureLine]
			});
			var vectorLine = new ol.layer.Vector({
				source : sourceLine
			});
			map.addLayer(vectorLine);

			setInterval(function() {
				var points = [];
				for (var i; i < m_way_points.length; i++) {
					points[i] = ol.proj.fromLonLat([m_way_points[i][1],
						m_way_points[i][0]]);
				}
				featureLine.setGeometry(new ol.geom.LineString(points));
			}, 1000);
		});
	}
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		var step = 5;
		var interval = 50;
		var timer;
		var timer_key;
		var menu_visible = false;
		var stereo_enabled = false;
		var plugin = {
			init_options : function(options) {
				if (!m_is_init) {
					m_is_init = true;
					init(plugin);
				}
			},
			event_handler : function(sender, event) {
				if (sender == "PLUGIN_HOST") {
					switch (event) {
						case "STEREO_ENABLED" :
							m_foward_button.style.display = "none";
							m_laser_button.style.display = "none";
							break;
						case "STEREO_DISABLED" :
							m_foward_button.style.display = "block";
							m_laser_button.style.display = "block";
							break;
					}
					return;
				} else if (sender == "ICADE") {
					switch (event) {
						case "B_BUTTON_UP" :
							event = "STEREO_ENABLED";
							break;
						case "G_BUTTON_DOWN" :
							event = "MOVE";
							break;
						case "G_BUTTON_UP" :
							event = "STOP"
							break;
						case "A_BUTTON_UP" :
							event = "MENU_VISIBLE";
							break;
						case "LEFT_BUTTON_DOWN" :
						case "RIGHT_BUTTON_DOWN" :
						case "UP_BUTTON_DOWN" :
						case "DOWN_BUTTON_DOWN" :
							if (menu_visible) {
							} else {
							}
							return;
						case "RIGHT_BUTTON_UP" :
							if (menu_visible) {
								event = "SELECT_ACTIVE_MENU";
							} else if (timer_key == "RIGHT_BUTTON_DOWN") {
							}
							break;
						case "LEFT_BUTTON_UP" :
							if (menu_visible) {
								event = "DESELECT_ACTIVE_MENU";
							} else if (timer_key == "LEFT_BUTTON_DOWN") {
							}
							break;
						case "UP_BUTTON_UP" :
							if (menu_visible) {
								event = "BACK2PREVIOUSE_MENU";
							} else if (timer_key == "UP_BUTTON_DOWN") {
							}
							break;
						case "DOWN_BUTTON_UP" :
							if (menu_visible) {
								event = "GO2NEXT_MENU";
							} else if (timer_key == "DOWN_BUTTON_DOWN") {
							}
							break;
					}
				} else if (sender == "GAMEPAD") {
					console.log(event);
					switch (event) {
						case "0_BUTTON_UP" :
							event = "PID_ENABLED";
							break;
						case "1_BUTTON_UP" :
							event = "STEREO_ENABLED";
							break;
						case "4_BUTTON_UP" :
							event = "MENU_VISIBLE";
							break;
						case "4_AXIS_FORWARD_UP" :
							if (menu_visible) {
								event = "SELECT_ACTIVE_MENU";
							}
							break;
						case "4_AXIS_BACKWARD_UP" :
							if (menu_visible) {
								event = "DESELECT_ACTIVE_MENU";
							}
							break;
						case "5_AXIS_FORWARD_UP" :
							if (menu_visible) {
								event = "BACK2PREVIOUSE_MENU";
							} else {
								event = "INCREMENT_PITCH";
							}
							break;
						case "5_AXIS_BACKWARD_UP" :
							if (menu_visible) {
								event = "GO2NEXT_MENU";
							} else {
								event = "DECREMENT_PITCH";
							}
							break;
					}
				}
				plugin.event_handler_act(event);
			},
			event_handler_act : function(event) {
				var params = event.split(" ");
				switch (params[0]) {
					case "MOVE" :
						var cmd = USVC_DOMAIN + "move";
						cmd += sprintf(" %.3f %.3f", MOVE_TIMEOUT, 50);
						m_plugin_host.send_command(cmd);
						break;
					case "STOP" :
						var cmd = USVC_DOMAIN + "stop";
						cmd += sprintf(" %.3f %.3f", 0, 0);
						m_plugin_host.send_command(cmd);
						break;
					case "STEREO_ENABLED" :
						stereo_enabled = !stereo_enabled;
						m_plugin_host.send_command("set_stereo "
							+ (stereo_enabled ? "1" : "0"));
						break;
					case "MENU_VISIBLE" :
						menu_visible = !menu_visible;
						m_plugin_host.set_menu_visible(menu_visible);
						break;
					case "SELECT_ACTIVE_MENU" :
						m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "select_active_menu");
						break;
					case "DESELECT_ACTIVE_MENU" :
						m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "deselect_active_menu");
						break;
					case "BACK2PREVIOUSE_MENU" :
						m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "back2previouse_menu");
						break;
					case "GO2NEXT_MENU" :
						m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "go2next_menu");
				}
			}
		};
		return plugin;
	}
})();