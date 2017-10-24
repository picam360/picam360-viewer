var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var ROV_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN + "rov_agent.";

	function init() {
	}
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		if (!m_is_init) {
			m_is_init = true;
			init();
		}
		var pid_enabled = false;
		var menu_visible = false;
		var stereo_enabled = false;
		var plugin = {
			event_handler : function(sender, event) {
				if (sender == "ICADE") {
					switch (event) {
						case "A_BUTTON_UP" :
							event = "PID_ENABLED";
							break;
						case "B_BUTTON_UP" :
							event = "STEREO_ENABLED";
							break;
						case "G_BUTTON_UP" :
							event = "MENU_VISIBLE";
							break;
						case "RIGHT_BUTTON_UP" :
							if (menu_visible) {
								event = "SELECT_ACTIVE_MENU";
							}
							break;
						case "LEFT_BUTTON_UP" :
							if (menu_visible) {
								event = "DESELECT_ACTIVE_MENU";
							}
							break;
						case "UP_BUTTON_UP" :
							if (menu_visible) {
								event = "BACK2PREVIOUSE_MENU";
							} else {
								event = "INCREMENT_THRUST";
							}
							break;
						case "DOWN_BUTTON_UP" :
							if (menu_visible) {
								event = "GO2NEXT_MENU";
							} else {
								event = "DECREMENT_THRUST";
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
								event = "INCREMENT_THRUST";
							}
							break;
						case "5_AXIS_BACKWARD_UP" :
							if (menu_visible) {
								event = "GO2NEXT_MENU";
							} else {
								event = "DECREMENT_THRUST";
							}
							break;
					}
				}
				switch (event) {
					case "PID_ENABLED" :
						pid_enabled = !pid_enabled;
						m_plugin_host.send_command(ROV_DOMAIN
							+ "set_pid_enabled " + (pid_enabled ? "1" : "0"));
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
					case "INCREMENT_THRUST" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = ROV_DOMAIN + "increment_thrust 1";
						cmd += sprintf(" %.3f,%.3f,%.3f,%.3f", quat.x, quat.y, quat.z, quat.w);
						m_plugin_host.send_command(cmd);
						break;
					case "DECREMENT_THRUST" :
						var quat = m_plugin_host.get_view_quaternion();
						quat = m_plugin_host.get_view_offset().multiply(quat);
						var cmd = ROV_DOMAIN + "increment_thrust -1";
						cmd += sprintf(" %.3f,%.3f,%.3f,%.3f", quat.x, quat.y, quat.z, quat.w);
						m_plugin_host.send_command(cmd);
						break;
				}
			}
		};
		return plugin;
	}
})();