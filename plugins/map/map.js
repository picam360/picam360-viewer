var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;
	
	function decodeUtf8(data) {
		var result = "";
		var i = 0;
		var c = 0;
		var c1 = 0;
		var c2 = 0;
		// If we have a BOM skip it
		if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb
			&& data[2] === 0xbf) {
			i = 3;
		}
		while (i < data.length) {
			c = data[i];

			if (c < 128) {
				result += String.fromCharCode(c);
				i++;
			} else if (c > 191 && c < 224) {
				if (i + 1 >= data.length) {
					throw "UTF-8 Decode failed. Two byte character was truncated.";
				}
				c2 = data[i + 1];
				result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				if (i + 2 >= data.length) {
					throw "UTF-8 Decode failed. Multi byte character was truncated.";
				}
				c2 = data[i + 1];
				c3 = data[i + 2];
				result += String.fromCharCode(((c & 15) << 12)
					| ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return result;
	}
	function map_load() {
		var options = {
			controls : [new OpenLayers.Control.Navigation(),
				new OpenLayers.Control.NavToolbar(),
				new OpenLayers.Control.PanZoomBar(),
				new OpenLayers.Control.ScaleLine(),
				// new OpenLayers.Control.ZoomPanel(),
				new OpenLayers.Control.Attribution()],
		};

		var map = new OpenLayers.Map("demoMap", options);
		map.addLayer(new OpenLayers.Layer.OSM());

		console.log(map.getProjectionObject().getCode());

		map.setCenter(new OpenLayers.LonLat(139.76, 35.68)
			.transform(new OpenLayers.Projection("EPSG:4326"), // WGS84
			new OpenLayers.Projection("EPSG:3857") // Google Map / OSM / etc
			// の球面メルカトル図法,
			// http://wiki.openstreetmap.org/wiki/Projection
			), 15);

	}
	function init(plugin) {
		m_plugin_host.getFile("plugins/map/map.html", function(chunk_array) {
			var txt = decodeUtf8(chunk_array[0]);
			var node = $.parseHTML(txt);
			$('body').append(node);
			var map_page = document.getElementById("map_page");
			ons.compile(node[0]);

			app.navi.on('postpush', function(event) {
				if (event.enterPage.name == "map.html") {
					map_load();
				}
			});

			var script = document.createElement('script');
			script.src = "http://www.openlayers.org/api/OpenLayers.js";
			document.head.appendChild(script);
		});
		m_plugin_host.getFile("plugins/map/map_list_item.html", function(
			chunk_array) {
			var txt = decodeUtf8(chunk_array[0]);
			var node = $.parseHTML(txt);
			$("#menu_list").append(node);
			ons.compile(node[0]);
		});
	}
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		var plugin = {
			init_options : function(options) {
				if (!m_is_init) {
					m_is_init = true;
					init(plugin);
				}
			},
			event_handler : function(sender, event) {

			}
		};
		return plugin;
	}
})();