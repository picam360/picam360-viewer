function MjpegDecoder() {
	var m_active_frame = null;
	var m_target_texture = null;

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
					//.log("update");
					if (m_target_texture) {
						var blob = new Blob(m_active_frame, {
							type : "image/jpeg"
						});
						var url = window.URL || window.webkitURL;
						m_target_texture.src = url.createObjectURL(blob);
						//console.log(m_target_texture.src + " : " + blob.size + " : " + m_active_frame.length);
						blob = null;
					}

					m_active_frame = null;
				}
			}
		}
	};
	return self;
}