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

	{
		var script = document.createElement('script');
		script.onload = function() {
			decoder = new libde265.Decoder(options);
			decoder.set_image_callback(function(image) {
				var w = image.get_width();
				var h = image.get_height();
				var image_data = new Uint8Array(w * h * 3);
				image.display(image_data, function(display_image_data) {
					m_frame_callback("raw_bmp", display_image_data, w, h);
				});
				// if (m_target_texture) {
				// m_frame_callback("yuv", buffer, width, height);
				// }
			});
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
		},
		// @data : Uint8Array
		decode : function(data, data_len) {
			// if (!is_init) {
			// is_init = true;
			// self.init();
			// }
			// if (!m_active_frame) {
			// if (data[0] == 0x4E && data[1] == 0x41) { // SOI
			// if (data.length > 2) {
			// m_active_frame = [new Uint8Array(data.buffer, data.byteOffset +
			// 2)];
			// } else {
			// m_active_frame = [];
			// }
			// }
			// } else {
			// if (data.length != 2) {
			// m_active_frame.push(data);
			// }
			// }
			// if (m_active_frame
			// && (data[data_len - 2] == 0x4C && data[data_len - 1] == 0x55)) {
			// // EOI
			// var nal_type = 0;
			// var nal_len = 0;
			// var _nal_len = 0;
			// if ((m_active_frame[0][4] & 0x1f) == 6) {// sei
			// var str = String.fromCharCode.apply("", m_active_frame[0]
			// .subarray(4), 0);
			// m_frame_info[(m_packet_frame_num + 1)] = {
			// info : str,
			// time : new Date().getTime()
			// };
			// m_active_frame.shift();
			// // console.log("sei : " + (m_packet_frame_num + 1));
			// }
			// for (var i = 0; i < m_active_frame.length; i++) {
			// if (i == 0) {
			// nal_len = m_active_frame[i][0] << 24
			// | m_active_frame[i][1] << 16
			// | m_active_frame[i][2] << 8 | m_active_frame[i][3];
			// _nal_len += m_active_frame[i].length - 4;
			//
			// // nal header 1byte
			// nal_type = m_active_frame[i][4] & 0x1f;
			// } else {
			// _nal_len += m_active_frame[i].length;
			// }
			// }
			// // console.log("nal_type:" + nal_type);
			// if (nal_len != _nal_len) {
			// console.log("error : " + nal_len);
			// m_active_frame = null;
			// return;
			// }
			// var nal_buffer = new Uint8Array(nal_len);
			// _nal_len = 0;
			// for (var i = 0; i < m_active_frame.length; i++) {
			// if (i == 0) {
			// nal_buffer.set(m_active_frame[i].subarray(4), 0);
			// _nal_len += m_active_frame[i].length - 4;
			// } else {
			// nal_buffer.set(m_active_frame[i], _nal_len);
			// _nal_len += m_active_frame[i].length;
			// }
			// }
			// if (!m_frame_start) {
			// if (nal_type == 7) {// sps
			// m_frame_start = true;
			// } else {
			// m_active_frame = null;
			// return;
			// }
			// }
			// if (nal_type == 1 || nal_type == 5) {// frame
			// m_packet_frame_num++;
			// // console.log("packet_frame_num:" +
			// // m_packet_frame_num);
			// }
			// decoder.push_data(nal_buffer);
			// decoder.decode(function(err) {
			// switch(err) {
			// case libde265.DE265_ERROR_WAITING_FOR_INPUT_DATA:
			// console.log("waiting");
			// return;
			//
			// default:
			// if (!libde265.de265_isOK(err)) {
			// console.log(libde265.de265_get_error_text(err));
			// return;
			// }
			// }
			// });
			//
			// m_active_frame = null;
			// }
			if (data) {
				decoder.push_data(data);
			} else {
				decoder.flush();
			}
			decoder.decode(function(err) {
				switch (err) {
					case libde265.DE265_ERROR_WAITING_FOR_INPUT_DATA :
						console.log("waiting");
						return;

					default :
						if (!libde265.de265_isOK(err)) {
							console.log(libde265.de265_get_error_text(err));
							return;
						}
				}
			});
		}
	};
	return self;
}
