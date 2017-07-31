var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

	function init() {
		var map = {
			"W" : "UP_BUTTON_DOWN",
			"E" : "UP_BUTTON_UP",
			"D" : "RIGHT_BUTTON_DOWN",
			"C" : "RIGHT_BUTTON_UP",
			"X" : "DOWN_BUTTON_DOWN",
			"Z" : "DOWN_BUTTON_UP",
			"A" : "LEFT_BUTTON_DOWN",
			"Q" : "LEFT_BUTTON_UP",
			"U" : "A_BUTTON_DOWN",
			"F" : "A_BUTTON_UP",
			"H" : "B_BUTTON_DOWN",
			"R" : "B_BUTTON_UP",
			"Y" : "C_BUTTON_DOWN",
			"T" : "C_BUTTON_UP",
			"J" : "D_BUTTON_DOWN",
			"N" : "D_BUTTON_UP",
			"I" : "E_BUTTON_DOWN",
			"M" : "E_BUTTON_UP",
			"K" : "F_BUTTON_DOWN",
			"P" : "F_BUTTON_UP",
			"O" : "G_BUTTON_DOWN",
			"G" : "G_BUTTON_UP",
			"L" : "H_BUTTON_DOWN",
			"V" : "H_BUTTON_UP",
		};
		window.onkeydown = function(e) {
			var key = String.fromCharCode(e.keyCode);
			if (map[key]) {
				if (m_plugin_host) {
					m_plugin_host.send_event("ICADE", map[key]);
				}
				// console.log("event : " + map[key]);
			} else {
				console.log("unknown : " + key);
			}
		}
	}
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		if (!m_is_init) {
			m_is_init = true;
			init();
		}
		var plugin = {};
		return plugin;
	}
})();