function H265Decoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;
	var m_frame_start = false;

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

	var worker = null;
	if (true) {
		var _worker = new Worker("lib/libde265/libde265_worker.js");
		_worker
			.addEventListener('message', function(e) {
				var data = e.data;
				if (data.ready) {
					worker = _worker;
					return;
				}
				if (data.consoleLog) {
					console.log(data.consoleLog);
					return;
				}
				if (m_frame_callback) {
					m_frame_callback({
						pixels : data.buf,
						width : data.width,
						stride : Math.ceil(data.width/32)*32,
						height : data.height,
						});
				}
			}, false);
	} else {
		var script = document.createElement('script');
		script.onload = function() {
			setTimeout(() => {
				decoder = new libde265.Decoder(options);
				decoder.disable_filters(true);
				decoder
					.set_image_callback(function(image) {
						if (m_frame_callback) {
							m_frame_callback({
								pixels : image.get_yuv(),
								width : image.get_width(),
								stride : Math.ceil(image.get_width()/32)*32,
								height : image.get_height(),
								});
						}
					});
			}, 500);//wait wasm load
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
		decode : function(data, end_of_frame) {
			if (!worker && !decoder) {
				packet_pool.push({data, end_of_frame});
				return;
			} else if (packet_pool.length != 0) {
				for (var i = 0; i < packet_pool.length; i++) {
					self._decode(packet_pool[i].data, packet_pool[i].end_of_frame);
				}
				packet_pool = [];
			}
			self._decode(data, end_of_frame);
		},
		_decode : function(data, end_of_frame) {
			if (!is_init) {
				is_init = true;
				self.init();
			}
			if (!m_active_frame && data[0] == 0 && data[1] == 0 && data[2] == 0 && data[3] == 1) {
				m_active_frame = [];
			}
			if (!m_active_frame){
				return;
			}
			m_active_frame.push(data);
			if (end_of_frame) {
				var nal_type = (m_active_frame[0][4] & 0x7e) >> 1;

				if (!m_frame_start) {
					if (nal_type == 32) {// vps
						m_frame_start = true;
					} else {
						m_active_frame = null;
						return;
					}
				}
				
				var nal_buffer;
				if(m_active_frame.length == 0){
					m_active_frame = null;
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
					}, [nal_buffer.buffer]); // Send data to our worker.
				} else {
					// decoder.push_data(annexb_sc);
					decoder.push_data(nal_buffer);
					decoder.flush();
					decoder.decode(function(err) {
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
				}

				m_active_frame = null;
			}
		}
	};
	return self;
}
