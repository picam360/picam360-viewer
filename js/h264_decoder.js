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
					m_frame_callback("yuv", data.buf, data.width, data.height, m_frame_info[m_decoded_frame_num].info, m_frame_info[m_decoded_frame_num].timestamp);
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
				// }
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
				&& (data[data_len - 2] == 0x4C && data[data_len - 1] == 0x55)) { // EOI
				var nal_type = m_active_frame[1][4] & 0x1f;

				if (!m_frame_start) {
					if (nal_type == 7) {// sps
						m_frame_start = true;
					} else {
						m_active_frame = null;
						return;
					}
				}

				if ((m_active_frame[0][4] & 0x1f) == 6) {// sei
					var frame_info = String.fromCharCode.apply("", m_active_frame[0]
						.subarray(5), 0);
					var timestamp = 0;
					var map = [];
					var split = frame_info.split(' ');
					for (var i = 0; i < split.length; i++) {
						var separator = (/[=,\"]/);
						var _split = split[i].split(separator);
						map[_split[0]] = _split;
					}
					if(map['timestamp']){
						timestamp = parseInt(map['timestamp'][2])*1000 + parseInt(map['timestamp'][3])/1000;
					}
					if (m_frame_start && timestamp) { // avoid other than picam360 sei
						m_packet_frame_num++;
						m_frame_info[m_packet_frame_num] = {
							info : frame_info,
							timestamp
						};
					}
					m_active_frame.shift();
				}
				
				var nal_buffer;
				if(m_active_frame.length == 0){
					return;
				} else if(m_active_frame.length == 1){
					nal_buffer =  m_active_frame[0];
				} else {
					var len = 0;
					for (var i = 0; i < m_active_frame.length; i++) {
						len += m_active_frame[i].length;
					}
					nal_buffer = new Uint8Array(len);
					var cur = 0;
					for (var i = 0; i < m_active_frame.length; i++) {
						nal_buffer.set(m_active_frame[i], cur);
						cur += m_active_frame[i].length;
					}
				}
				if (worker) {
					worker.postMessage({
						buf : nal_buffer,
						offset : 0,
						length : nal_buffer.length,
						info : null
					}, [nal_buffer.buffer]); // Send data to our worker.
				} else if (decoder) {
					decoder.decode(nal_buffer, null);
				}

				m_active_frame = null;
			}
		}
	};
	return self;
}
