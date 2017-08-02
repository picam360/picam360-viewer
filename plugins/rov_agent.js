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
							pid_enabled = !pid_enabled;
							m_plugin_host.send_command(ROV_DOMAIN
								+ "set_pid_enabled "
								+ (pid_enabled ? "1" : "0"));
							break;
						case "B_BUTTON_UP" :
							stereo_enabled = !stereo_enabled;
							m_plugin_host.send_command("set_stereo "
								+ (stereo_enabled ? "1" : "0"));
							break;
						case "G_BUTTON_UP" :
							menu_visible = !menu_visible;
							m_plugin_host.send_command(SYSTEM_DOMAIN
								+ "set_menu_visible "
								+ (menu_visible ? "1" : "0"));
							break;
						case "RIGHT_BUTTON_UP" :
							if (menu_visible) {
								m_plugin_host.send_command(SYSTEM_DOMAIN
									+ "select_active_menu");
							}
							break;
						case "LEFT_BUTTON_UP" :
							if (menu_visible) {
								m_plugin_host.send_command(SYSTEM_DOMAIN
									+ "deselect_active_menu");
							}
							break;
						case "UP_BUTTON_UP" :
							if (menu_visible) {
								m_plugin_host.send_command(SYSTEM_DOMAIN
									+ "back2previouse_menu");
							} else {
								m_plugin_host.send_command(ROV_DOMAIN
									+ "increment_thrust 1");
							}
							break;
						case "DOWN_BUTTON_UP" :
							if (menu_visible) {
								m_plugin_host.send_command(SYSTEM_DOMAIN
									+ "go2next_menu");
							} else {
								m_plugin_host.send_command(ROV_DOMAIN
									+ "increment_thrust -1");
							}
							break;
					}
				}
			}
		};
		return plugin;
	}
})();