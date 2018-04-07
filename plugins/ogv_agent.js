var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var OMNI_LAZER_DOMAIN = UPSTREAM_DOMAIN + "omni_lazer.";
	var OMNI_WHEEL_DOMAIN = UPSTREAM_DOMAIN + "omni_wheel.";
	var MOVE_TIMEOUT = 60*1000;//1min

	function init() {
	}
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		if (!m_is_init) {
			m_is_init = true;
			init();
		}
		var step = 5;
		var interval = 50;
		var timer;
		var timer_key;
		var menu_visible = false;
		var stereo_enabled = false;
		var plugin = {
			event_handler : function(sender, event) {
				if (sender == "ICADE") {
					switch (event) {
					case "H_BUTTON_UP":
						event = "FIRE";
						break;
					case "B_BUTTON_UP":
						event = "STEREO_ENABLED";
						break;
					case "G_BUTTON_DOWN":
						event = "MOVE";
						break;
					case "G_BUTTON_UP":
						event = "STOP"
						break;
					case "A_BUTTON_UP":
						event = "MENU_VISIBLE";
						break;
					case "LEFT_BUTTON_DOWN":
					case "RIGHT_BUTTON_DOWN":
					case "UP_BUTTON_DOWN":
					case "DOWN_BUTTON_DOWN":
						if (menu_visible) {
						} else {
							clearInterval(timer);
							timer_key = event;
							timer = setInterval(
									function() {
										switch (event) {
										case "LEFT_BUTTON_DOWN":
											plugin
													.event_handler_act("INCREMENT_YAW");
											break;
										case "RIGHT_BUTTON_DOWN":
											plugin
													.event_handler_act("DECREMENT_YAW");
											break;
										case "UP_BUTTON_DOWN":
											plugin
													.event_handler_act("INCREMENT_PITCH");
											break;
										case "DOWN_BUTTON_DOWN":
											plugin
													.event_handler_act("DECREMENT_PITCH");
											break;
										}
									}, interval);
						}
						return;
					case "RIGHT_BUTTON_UP":
						if (menu_visible) {
							event = "SELECT_ACTIVE_MENU";
						} else if (timer_key == "RIGHT_BUTTON_DOWN") {
							clearInterval(timer);
						}
						break;
					case "LEFT_BUTTON_UP":
						if (menu_visible) {
							event = "DESELECT_ACTIVE_MENU";
						} else if (timer_key == "LEFT_BUTTON_DOWN") {
							clearInterval(timer);
						}
						break;
					case "UP_BUTTON_UP":
						if (menu_visible) {
							event = "BACK2PREVIOUSE_MENU";
						} else if (timer_key == "UP_BUTTON_DOWN") {
							clearInterval(timer);
						}
						break;
					case "DOWN_BUTTON_UP":
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
					case "0_BUTTON_UP":
						event = "PID_ENABLED";
						break;
					case "1_BUTTON_UP":
						event = "STEREO_ENABLED";
						break;
					case "4_BUTTON_UP":
						event = "MENU_VISIBLE";
						break;
					case "4_AXIS_FORWARD_UP":
						if (menu_visible) {
							event = "SELECT_ACTIVE_MENU";
						}
						break;
					case "4_AXIS_BACKWARD_UP":
						if (menu_visible) {
							event = "DESELECT_ACTIVE_MENU";
						}
						break;
					case "5_AXIS_FORWARD_UP":
						if (menu_visible) {
							event = "BACK2PREVIOUSE_MENU";
						} else {
							event = "INCREMENT_PITCH";
						}
						break;
					case "5_AXIS_BACKWARD_UP":
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
				switch (event) {
				case "FIRE":
					m_plugin_host.send_command(OMNI_LAZER_DOMAIN + "fire");
					break;
				case "MOVE":
					var cmd = OMNI_WHEEL_DOMAIN + "move";
					cmd += sprintf(" %.3f %.3f", MOVE_TIMEOUT, 50);
					m_plugin_host.send_command(cmd);
					break;
				case "STOP":
					var cmd = OMNI_WHEEL_DOMAIN + "stop";
					cmd += sprintf(" %.3f %.3f", 0, 0);
					m_plugin_host.send_command(cmd);
					break;
				case "PID_ENABLED":
					pid_enabled = !pid_enabled;
					m_plugin_host.send_command(OMNI_LAZER_DOMAIN
							+ "set_pid_enabled " + (pid_enabled ? "1" : "0"));
					break;
				case "STEREO_ENABLED":
					stereo_enabled = !stereo_enabled;
					m_plugin_host.send_command("set_stereo "
							+ (stereo_enabled ? "1" : "0"));
					break;
				case "MENU_VISIBLE":
					menu_visible = !menu_visible;
					m_plugin_host.set_menu_visible(menu_visible);
					break;
				case "SELECT_ACTIVE_MENU":
					m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "select_active_menu");
					break;
				case "DESELECT_ACTIVE_MENU":
					m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "deselect_active_menu");
					break;
				case "BACK2PREVIOUSE_MENU":
					m_plugin_host.send_command(SYSTEM_DOMAIN
							+ "back2previouse_menu");
					break;
				case "GO2NEXT_MENU":
					m_plugin_host.send_command(SYSTEM_DOMAIN + "go2next_menu");
					break;
				case "INCREMENT_YAW":
					var quat = m_plugin_host.get_view_quaternion();
					quat = m_plugin_host.get_view_offset().multiply(quat);
					var cmd = OMNI_LAZER_DOMAIN + "increment_yaw " + step;
					m_plugin_host.send_command(cmd);
					break;
				case "DECREMENT_YAW":
					var quat = m_plugin_host.get_view_quaternion();
					quat = m_plugin_host.get_view_offset().multiply(quat);
					var cmd = OMNI_LAZER_DOMAIN + "increment_yaw -" + step;
					m_plugin_host.send_command(cmd);
					break;
				case "INCREMENT_PITCH":
					var quat = m_plugin_host.get_view_quaternion();
					quat = m_plugin_host.get_view_offset().multiply(quat);
					var cmd = OMNI_LAZER_DOMAIN + "increment_pitch " + step;
					m_plugin_host.send_command(cmd);
					break;
				case "DECREMENT_PITCH":
					var quat = m_plugin_host.get_view_quaternion();
					quat = m_plugin_host.get_view_offset().multiply(quat);
					var cmd = OMNI_LAZER_DOMAIN + "increment_pitch -" + step;
					m_plugin_host.send_command(cmd);
					break;
				}
			}
		};
		return plugin;
	}
})();