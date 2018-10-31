function OpusDecoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_frame_start = false;
	var m_packet_frame_num = 0;
	var m_decoded_frame_num = 0;
	var m_frame_info = {};

	var decoder_file = "lib/libopus/opus-stream-decoder.js";
	var options = {};
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
		worker = new Worker("js/libopus_worker.js");
		worker
			.addEventListener('message', function(e) {
				var data = e.data;
				if (data.consoleLog) {
					console.log(data.consoleLog);
					return;
				};
				m_decoded_frame_num++;
				if (m_frame_callback) {
					m_frame_callback(new Float32Array(e.data.left), new Float32Array(e.data.right));
				}
			}, false);
	} else {
		var script = document.createElement('script');
		script.onload = function() {
			var _decoder = new OpusStreamDecoder({
				onDecode : function(res) {
					if (m_frame_callback) {
						m_frame_callback(res.left, res.right);
					}
				}
			});
			_decoder.ready.then(function() {
				decoder = _decoder;
			});
		};
		script.src = decoder_file;

		document.head.appendChild(script);
	}

	var is_init = false;
	var info = {};
	var packet_pool = [];
	var head = null;
	var comment = null;

	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		init : function() {
		},
		// @data : Uint8Array
		decode : function(data) {
			if (!worker && !decoder) {
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

			if (data[28] == 0x4f && data[29] == 0x70 && data[30] == 0x75
				&& data[31] == 0x73 && data[32] == 0x48 && data[33] == 0x65
				&& data[34] == 0x61 && data[35] == 0x64) { // OpusHead
				if (head == null) {
					head = data;
				} else {
					return;
				}
			} else if (data[28] == 0x4f && data[29] == 0x70
				&& data[30] == 0x75 && data[31] == 0x73 && data[32] == 0x54
				&& data[33] == 0x61 && data[34] == 0x67 && data[35] == 0x73) { // OpusTags
				if (comment == null) {
					comment = data;
				} else {
					return;
				}
			} else if (head == null || comment == null) {
				return;
			}

			var buffer = (data.byteOffset)
				? data.buffer.slice(data.byteOffset)
				: data.buffer;

			if (worker) {
				worker.postMessage({
					buf : buffer,
					offset : 0,
					length : data.length,
					info : null
				}, [buffer]); // Send data to our worker.
			} else {
				decoder.decode(data);
			}
		}
	};
	return self;
}
