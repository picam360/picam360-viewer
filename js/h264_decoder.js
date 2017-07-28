function H264Decoder() {
	var m_active_frame = null;
	var m_target_texture = null;

	function get_bmp_header(width, height, depth) {
		var header_size = depth <= 8 ? 54 + Math.pow(2, depth) * 4 : 54;
		var buffer = new ArrayBuffer(header_size);
		var view = new DataView(buffer);
		var bytes_in_pixel = depth / 8;
		var bytes_os_pixels = width * height * bytes_in_pixel;

		// BMP Header
		view.setUint8(0, 'BM'.charCodeAt(0)); // ID field
		view.setUint8(1, 'BM'.charCodeAt(1)); // ID field
		view.setUint32(2, header_size + bytes_os_pixels, true); // BMP size
		view.setUint32(6, 0, true); // unused
		view.setUint32(10, header_size, true); // pixel data offset

		// DIB Header
		view.setUint32(14, 40, true); // DIB header length
		view.setUint32(18, width, true); // image width
		view.setUint32(22, height, true); // image height
		view.setUint16(26, 1, true); // colour panes
		view.setUint16(28, depth, true); // bits per pixel
		view.setUint32(30, 0, true);// compression method
		view.setUint32(34, bytes_os_pixels, true);// size of the raw data
		view.setUint32(38, 2835, true);// horizontal print resolution
		view.setUint32(42, 2835, true); // vertical print resolution
		view.setUint32(46, 0, true); // colour palette, 0 == 2^n
		view.setUint32(50, 0, true); // important colours

		// // Grayscale tables for bit depths <= 8
		// if (depth <= 8) {
		// data += conv(0);
		//
		// for (var s = Math.floor(255 / (Math.pow(2, depth) - 1)), i = s; i <
		// 256;
		// i += s) {
		// data += conv(i + i * 256 + i * 65536);
		// }
		// }

		return new Uint8Array(buffer);
	}

	var decoder_file = "lib/Broadway/Decoder.js";
	var options = {
		rgb : true,
		reuseMemory : true
	};
	var decoder = null;
	var worker = null;
	if (true) {
		worker = new Worker(decoder_file);
		worker.addEventListener('message', function(e) {
			var data = e.data;
			if (data.consoleLog) {
				console.log(data.consoleLog);
				return;
			};

			//console.log("frame");
			if (m_target_texture) {
				var header = get_bmp_header(data.width, data.height, 32);
				var raw_data = new Uint8Array(data.buf);
				var blob = new Blob([header, raw_data], {
					type : "image/bmp"
				});
				var url = window.URL || window.webkitURL;
				if (m_target_texture.src
					&& m_target_texture.src.indexOf("blob") == 0) {
					url.revokeObjectURL(m_target_texture.src);
				}
				m_target_texture.src = url.createObjectURL(blob);
				// console.log(m_target_texture.src + " : " + blob.size
				// + " : " + m_active_frame.length);
				blob = null;
			}

			// onPictureDecoded
			// .call(self, new Uint8Array(data.buf, 0, data.length), data.width,
			// data.height, data.infos);

		}, false);
	} else {
		var script = document.createElement('script');
		script.onload = function() {
			decoder = new Decoder(options);
			decoder.onPictureDecoded = function() {
				console.log("onPictureDecoded");
				return;
			}
		};
		script.src = decoder_file;

		document.head.appendChild(script);
	}
	var is_init = false;
	var info = {};

	var self = {
		set_target_texture : function(texture) {
			m_target_texture = texture;
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
				if (data[0] == 0xFF && data[1] == 0xD8) { // SOI
					m_active_frame = [];
				}
			}
			if (m_active_frame) {
				if (data.length != 2) {
					m_active_frame.push(data);
				}
				if (data[data_len - 2] == 0xFF && data[data_len - 1] == 0xD9) { // EOI
					var nal_len = 0;
					var _nal_len = 0;
					for (var i = 0; i < m_active_frame.length; i++) {
						if (i == 0) {
							var nal_len = m_active_frame[i][0] << 24
								| m_active_frame[i][1] << 16
								| m_active_frame[i][2] << 8
								| m_active_frame[i][3];
							_nal_len += m_active_frame[i].length - 4;
						} else {
							_nal_len += m_active_frame[i].length;
						}
					}
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
