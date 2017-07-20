function MjpegDecoder() {
	var m_active_frame = null;
	var m_target_texture = null;

	function Uint8ToString(ary) {
		var CHUNK_SZ = 0x8000;
		var c = [];
		if (!Array.isArray(ary)) {
			ary = [ary];
		}
		ary.forEach(function(u8a) {
			for (var i = 0; i < u8a.length; i += CHUNK_SZ) {
				c.push(String.fromCharCode.apply(null, u8a.subarray(i, i
					+ CHUNK_SZ)));
			}
		});
		return c.join("");
	}

	var self = {
		set_target_texture : function(texture) {
			m_target_texture = texture;
		},
		// @data : Uint8Array
		decode : function(data, data_len) {
			if (!m_active_frame) {
				if (data[0] == 0xFF && data[1] == 0xD8) { // SOI
					m_active_frame = [];
				}
			}
			if (m_active_frame) {
				m_active_frame.push(data);
				if (data[data_len - 2] == 0xFF && data[data_len - 1] == 0xD9) { // EOI
					console.log("update");
					if (m_target_texture) {
						var base64img = btoa(Uint8ToString(m_active_frame));
						m_target_texture.src = "data:image/jpeg;base64,"
							+ base64img;
					}

					m_active_frame = null;
				}
			}
		}
	};
	return self;
}