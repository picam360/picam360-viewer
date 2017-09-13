function H264Decoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_frame_start = false;
	var m_packet_frame_num = 0;
	var m_decoded_frame_num = 0;
	var m_frame_info = {};

	var decoder_file = "lib/Broadway/Decoder.js";
	var options = {
		rgb : false,
		reuseMemory : true
	};
	var decoder = null;
	var worker = null;
	if (true) {
		worker = new Worker(decoder_file);
		worker
			.addEventListener('message', function(e) {
				var data = e.data;
				if (data.consoleLog) {
					console.log(data.consoleLog);
					return;
				};

				// console.log("frame");
				m_decoded_frame_num++;
				if (m_decoded_frame_num > m_packet_frame_num) {
					console.log("something wrong");
				}
				if (m_frame_callback) {
					var info = m_frame_info[m_decoded_frame_num];
					if (!info) {
						console.log("no view quat info:" + m_decoded_frame_num
							+ ":" + m_frame_info);
					}
					m_frame_callback("yuv", data.buf, data.width, data.height, m_frame_info[m_decoded_frame_num]);
				}
				var frame_info = {};
				for (var i = m_decoded_frame_num; i <= m_packet_frame_num; i++) {
					if (m_frame_info[i]) {
						frame_info[i] = m_frame_info[i];
					} else {
						console.log("no view quat info:" + i);
					}
				}
				m_frame_info = frame_info;
				// if (m_decoded_frame_num != m_packet_frame_num) {
				// console.log("packet & decode are not synchronized:"
				// + m_decoded_frame_num + "-" + m_packet_frame_num);
				//				}
			}, false);
	} else {
		var script = document.createElement('script');
		script.onload = function() {
			decoder = new Decoder(options);
			decoder.onPictureDecoded = function(buffer, width, height, infos) {
				// console.log("frame");
				if (m_target_texture) {
					m_frame_callback("yuv", buffer, width, height);
				}
			}
		};
		script.src = decoder_file;

		document.head.appendChild(script);
	}
	var is_init = false;
	var info = {};

	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		init : function() {
			if (worker) {
				worker.postMessage({
					type : "Broadway.js - Worker init",
					options : options
				});
			}
		},
		// @data : Uint8Array
		decode : function(data, data_len) {
			if (!is_init) {
				is_init = true;
				self.init();
			}
			if (!m_active_frame) {
				if (data[0] == 0x4E && data[1] == 0x41) { // SOI
					m_active_frame = [];
				}
			}
			if (m_active_frame) {
				if (data.length != 2) {
					m_active_frame.push(data);
				}
				if (data[data_len - 2] == 0x4C && data[data_len - 1] == 0x55) { // EOI
					var nal_type = 0;
					var nal_len = 0;
					var _nal_len = 0;
					if ((m_active_frame[0][4] & 0x1f) == 6) {// sei
						var str = String.fromCharCode
							.apply("", m_active_frame[0].subarray(4), 0);
						m_frame_info[(m_packet_frame_num + 1)] = str;
						m_active_frame.shift();
						//console.log("sei : " + (m_packet_frame_num + 1));
					}
					for (var i = 0; i < m_active_frame.length; i++) {
						if (i == 0) {
							nal_len = m_active_frame[i][0] << 24
								| m_active_frame[i][1] << 16
								| m_active_frame[i][2] << 8
								| m_active_frame[i][3];
							_nal_len += m_active_frame[i].length - 4;

							// nal header 1byte
							nal_type = m_active_frame[i][4] & 0x1f;
						} else {
							_nal_len += m_active_frame[i].length;
						}
					}
					//console.log("nal_type:" + nal_type);
					if (nal_len != _nal_len) {
						console.log("error : " + nal_len);
						m_active_frame = null;
						return;
					}
					var nal_buffer = new Uint8Array(nal_len);
					_nal_len = 0;
					for (var i = 0; i < m_active_frame.length; i++) {
						if (i == 0) {
							nal_buffer.set(m_active_frame[i].subarray(4), 0);
							_nal_len += m_active_frame[i].length - 4;
						} else {
							nal_buffer.set(m_active_frame[i], _nal_len);
							_nal_len += m_active_frame[i].length;
						}
					}
					if (!m_frame_start) {
						if (nal_type == 7) {// sps
							m_frame_start = true;
						} else {
							m_active_frame = null;
							return;
						}
					}
					if (nal_type == 1 || nal_type == 5) {// frame
						m_packet_frame_num++;
						//console.log("packet_frame_num:" + m_packet_frame_num);
					}
					if (worker) {
						worker.postMessage({
							buf : nal_buffer.buffer,
							offset : 0,
							length : nal_len,
							info : null
						}, [nal_buffer.buffer]); // Send data to our worker.
					} else if (decoder) {
						decoder.decode(nal_buffer, null);
					}

					m_active_frame = null;
				}
			}
		}
	};
	return self;
}
