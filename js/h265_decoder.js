function H265Decoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_frame_start = false;
	var m_packet_frame_num = 0;
	var m_decoded_frame_num = 0;
	var m_frame_info = {};

	var decoder_file = "lib/libde265/libde265.js";
	var options = {
		rgb : false,
		reuseMemory : true
	};
	var decoder = null;

	function GetQueryString() {
		var result = {};
		if (1 < window.location.search.length) {
			var query = window.location.search.substring(1);
			var parameters = query.split('&');

			for (var i = 0; i < parameters.length; i++) {
				var element = parameters[i].split('=');

				var paramName = decodeURIComponent(element[0]);
				var paramValue = decodeURIComponent(element[1]);

				result[paramName] = paramValue;
			}
		}
		return result;
	}
	var query = GetQueryString();

	{
		var script = document.createElement('script');
		script.onload = function() {
			decoder = new libde265.Decoder(options);
			decoder
				.set_image_callback(function(image) {
					m_decoded_frame_num++;
					// console.log("m_decoded_frame_num:" +
					// m_decoded_frame_num);
					if (m_decoded_frame_num > m_packet_frame_num) {
						console.log("something wrong");
					}

					if (m_frame_callback) {
						var info = m_frame_info[m_decoded_frame_num];
						if (!info) {
							console.log("no view quat info:"
								+ m_decoded_frame_num + ":"
								+ m_frame_info.length);
						}
						m_frame_callback("yuv", image.get_yuv(), image
							.get_width(), image.get_height(), info
							? info.info
							: null, info ? info.time : 0);
					}
					var frame_info = {};
					for (var i = m_decoded_frame_num + 1; i <= m_packet_frame_num; i++) {
						if (m_frame_info[i]) {
							frame_info[i] = m_frame_info[i];
						} else {
							console.log("no view quat info:" + i);
						}
					}
					m_frame_info = frame_info;
					// if (m_decoded_frame_num != m_packet_frame_num) {
					// console.log("packet & decode are not
					// synchronized:"
					// + m_decoded_frame_num + "-" +
					// m_packet_frame_num);
					// }
				});
		};
		script.src = decoder_file;

		document.head.appendChild(script);
	}

	var is_init = false;
	var info = {};
	var packet_pool = [];

	// annexb sc is 0001,avcc sc is nalu_len
	var annexb_sc = new Uint8Array(4);
	annexb_sc[0] = 0;
	annexb_sc[1] = 0;
	annexb_sc[2] = 0;
	annexb_sc[3] = 1;

	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		init : function() {
		},
		// @data : Uint8Array
		decode : function(data) {
			if (!decoder) {
				packet_pool.push(data);
				return;
			} else if (packet_pool.length != 0) {
				for (var i = 0; packet_pool.length; i++) {
					self._decode(packet_pool[i]);
					packet_pool = [];
				}
			}
			self._decode(data);
		},
		_decode : function(data) {
			if (!is_init) {
				is_init = true;
				self.init();
			}
			if (!m_active_frame) {
				if (data[0] == 0x48 && data[1] == 0x45) { // SOI
					if (data.length > 2) {
						m_active_frame = [new Uint8Array(data.buffer, data.byteOffset + 2)];
					} else {
						m_active_frame = [];
					}
				}
			} else {
				if (data.length != 2) {
					m_active_frame.push(data);
				}
			}
			if (m_active_frame
				&& (data[data.length - 2] == 0x56 && data[data.length - 1] == 0x43)) {// EOI
				var nal_type = 0;
				var nal_len = 0;
				var _nal_len = 0;
				if (((m_active_frame[0][4] & 0x7e) >> 1) == 40) {// sei
					var str = String.fromCharCode.apply("", m_active_frame[0]
						.subarray(4), 0);
					var split = str.split(' ');
					var mode = null;
					for (var i = 0; i < split.length; i++) {
						var separator = (/[=,\"]/);
						var _split = split[i].split(separator);
						if (_split[0] == "mode") {
							mode = _split[2];
						}
					}
					if (m_frame_start && mode) {
						m_packet_frame_num++;
						m_frame_info[m_packet_frame_num] = {
							info : str,
							time : new Date().getTime()
						};
						// console.log("packet_frame_num:" + m_packet_frame_num
						// + ":" + str);
					}
					m_active_frame.shift();
				}
				for (var i = 0; i < m_active_frame.length; i++) {
					if (i == 0) {
						nal_len = m_active_frame[i][0] << 24
							| m_active_frame[i][1] << 16
							| m_active_frame[i][2] << 8 | m_active_frame[i][3];
						_nal_len += m_active_frame[i].length - 4;

						// nal header 1byte
						nal_type = (m_active_frame[i][4] & 0x7e) >> 1;
					} else {
						_nal_len += m_active_frame[i].length;
					}
				}
				if (query['h265-debug']) {
					console.log("nal_len:" + nal_len + "," + _nal_len
						+ ":nal_type:" + nal_type);
				}
				if (nal_len != _nal_len) {
					console.log("error : " + nal_len + "!=" + _nal_len);
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
					if (nal_type == 32) {// vps
						m_frame_start = true;
					} else {
						m_active_frame = null;
						return;
					}
				}

				decoder.push_data(annexb_sc);
				decoder.push_data(nal_buffer);
				decoder.flush();
				decoder
					.decode(function(err) {
						switch (err) {
							case libde265.DE265_ERROR_WAITING_FOR_INPUT_DATA :
								console.log("waiting");
								return;

							default :
								if (!libde265.de265_isOK(err)) {
									console.log(libde265
										.de265_get_error_text(err));
									return;
								}
						}
					});

				m_active_frame = null;
			}
		}
	};
	return self;
}
