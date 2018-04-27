var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;
	var m_forward_button = null;
	var m_lazer_button = null;

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var OMNI_LAZER_DOMAIN = UPSTREAM_DOMAIN + "omni_lazer.";
	var OMNI_WHEEL_DOMAIN = UPSTREAM_DOMAIN + "omni_wheel.";
	var MOVE_TIMEOUT = 60 * 1000;// 1min

	var FORWARD_ICON = "data:image/png;base64,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";
	var LAZER_ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAMAAADDpiTIAAADAFBMVEX///8zMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMvIC5hAAAA/3RSTlMAsMig/vwCAf0E+vvvA/byGAsFBxQKDRX4EPQJ+d4G9yaeoQgOvtUa9eMe6RaC8Q/l18VkLNZt7SFpjNy7b5d8s/NS7kHa8DckHys96hIo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";

	function create_forward_button(plugin) {
		var button = document.createElement("img");
		button.src = FORWARD_ICON;
		var mousedownFunc = function(ev) {
			plugin.event_handler_act("MOVE");
		}
		var mouseupFunc = function() {
			plugin.event_handler_act("STOP");
		}
		button.addEventListener("touchstart", mousedownFunc);
		button.addEventListener("touchend", mouseupFunc);
		button.addEventListener("mousedown", mousedownFunc);
		button.addEventListener("mouseup", mouseupFunc);

		return button;
	}
	function create_lazer_button(plugin) {
		var button = document.createElement("img");
		button.src = LAZER_ICON;

		var down = false;
		var sx = 0, sy = 0;
		var mousedownFunc = function(ev) {
			plugin.event_handler_act("FIRE");

			if (ev.type == "touchstart") {
				ev.clientX = ev.pageX;
				ev.clientY = ev.pageY;
			}
			down = true;
			sx = ev.clientX;
			sy = ev.clientY;
		}
		var mouseupFunc = function() {
			plugin.event_handler_act("FIRE_OFF");

			down = false;
		}
		var mousemoveFunc = function(ev) {
			if (ev.type == "touchmove") {
				ev.clientX = ev.pageX;
				ev.clientY = ev.pageY;
				ev.button = 0;
			}
			if (!down || ev.button != 0) {
				return;
			}
			var dx = -(ev.clientX - sx);
			var dy = -(ev.clientY - sy);

			var threshold = 5;
			var roll_diff = parseInt(dx / threshold) * threshold;
			var pitch_diff = parseInt(dy / threshold) * threshold;
			sx -= roll_diff;
			sy -= pitch_diff;

			if (roll_diff == 0) {
				// do nothing
			} else {
				plugin.event_handler_act("INCREMENT_YAW " + roll_diff);
			}
			if (pitch_diff == 0) {
				// do nothing
			} else {
				plugin.event_handler_act("INCREMENT_PITCH " + pitch_diff);
			}
			ev.preventDefault();
			ev.stopPropagation();
		}
		button.addEventListener("touchstart", mousedownFunc);
		button.addEventListener("touchend", mouseupFunc);
		button.addEventListener("mousedown", mousedownFunc);
		button.addEventListener("mouseup", mouseupFunc);
		button.addEventListener("touchmove", mousemoveFunc);
		button.addEventListener("mousemove", mousemoveFunc);

		return button;
	}
	function init(plugin) {
		m_foward_button = create_forward_button(plugin);
		m_foward_button.style.position = 'absolute';
		m_foward_button.width = 50;
		m_foward_button.height = 50;
		m_foward_button
			.setAttribute("style", "position:absolute; bottom:33%; right:10%;");

		m_lazer_button = create_lazer_button(plugin);
		m_lazer_button.style.position = 'absolute';
		m_lazer_button.width = 50;
		m_lazer_button.height = 50;
		m_lazer_button
			.setAttribute("style", "position:absolute; bottom:66%; right:10%;");

		document.body.appendChild(m_foward_button);
		document.body.appendChild(m_lazer_button);
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
							m_lazer_button.style.display = "none";
							break;
						case "STEREO_DISABLED" :
							m_foward_button.style.display = "block";
							m_lazer_button.style.display = "block";
							break;
					}
					return;
				} else if (sender == "ICADE") {
					switch (event) {
						case "H_BUTTON_DOWN" :
							event = "FIRE";
							break;
						case "H_BUTTON_UP" :
							event = "FIRE_OFF";
							break;
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
								clearInterval(timer);
								timer_key = event;
								timer = setInterval(function() {
									switch (event) {
										case "LEFT_BUTTON_DOWN" :
											plugin
												.event_handler_act("INCREMENT_YAW");
											break;
										case "RIGHT_BUTTON_DOWN" :
											plugin
												.event_handler_act("DECREMENT_YAW");
											break;
										case "UP_BUTTON_DOWN" :
											plugin
												.event_handler_act("INCREMENT_PITCH");
											break;
										case "DOWN_BUTTON_DOWN" :
											plugin
												.event_handler_act("DECREMENT_PITCH");
											break;
									}
								}, interval);
							}
							return;
						case "RIGHT_BUTTON_UP" :
							if (menu_visible) {
								event = "SELECT_ACTIVE_MENU";
							} else if (timer_key == "RIGHT_BUTTON_DOWN") {
								clearInterval(timer);
							}
							break;
						case "LEFT_BUTTON_UP" :
							if (menu_visible) {
								event = "DESELECT_ACTIVE_MENU";
							} else if (timer_key == "LEFT_BUTTON_DOWN") {
								clearInterval(timer);
							}
							break;
						case "UP_BUTTON_UP" :
							if (menu_visible) {
								event = "BACK2PREVIOUSE_MENU";
							} else if (timer_key == "UP_BUTTON_DOWN") {
								clearInterval(timer);
							}
							break;
						case "DOWN_BUTTON_UP" :
							if (menu_visible) {
								event = "GO2NEXT_MENU";
							} else if (timer_key == "DOWN_BUTTON_DOWN") {
								clearInterval(timer);
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
					case "FIRE" :
						m_plugin_host.send_command(OMNI_LAZER_DOMAIN + "fire");
						break;
					case "FIRE_OFF" :
						m_plugin_host.send_command(OMNI_LAZER_DOMAIN
							+ "fire_off");
						break;
					case "MOVE" :
						var cmd = OMNI_WHEEL_DOMAIN + "move";
						cmd += sprintf(" %.3f %.3f", MOVE_TIMEOUT, 50);
						m_plugin_host.send_command(cmd);
						break;
					case "STOP" :
						var cmd = OMNI_WHEEL_DOMAIN + "stop";
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
						break;
					case "INCREMENT_YAW" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = OMNI_LAZER_DOMAIN + "increment_yaw "
							+ (params[1] ? params[1] : step);
						m_plugin_host.send_command(cmd);
						break;
					case "DECREMENT_YAW" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = OMNI_LAZER_DOMAIN + "increment_yaw -"
							+ (params[1] ? params[1] : step);
						m_plugin_host.send_command(cmd);
						break;
					case "INCREMENT_PITCH" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = OMNI_LAZER_DOMAIN + "increment_pitch "
							+ (params[1] ? params[1] : step);
						m_plugin_host.send_command(cmd);
						break;
					case "DECREMENT_PITCH" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = OMNI_LAZER_DOMAIN + "increment_pitch -"
							+ (params[1] ? params[1] : step);
						m_plugin_host.send_command(cmd);
						break;
				}
			}
		};
		return plugin;
	}
})();