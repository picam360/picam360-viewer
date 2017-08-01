function MjpegDecoder() {
	var m_active_frame = null;
	var m_frame_callback = null;

	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
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
					if (m_frame_callback) {
						var blob = new Blob(m_active_frame, {
							type : "image/jpeg"
						});
						m_frame_callback("blob", blob);
						blob = null;
					}

					m_active_frame = null;
				}
			}
		}
	};
	return self;
}