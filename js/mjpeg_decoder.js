function MjpegDecoder() {
	var m_frame_callback = null;

	function createWorker(f) {
	    return new Worker(URL.createObjectURL(new Blob([`(${f})()`])));
	}

	var worker = createWorker(() => {
		var m_active_frame = null;
		var m_active_frame_st = 0;
		var SOIMARKER = new Uint8Array(2);
		SOIMARKER[0] = 0xFF;
		SOIMARKER[1] = 0xD8;
		var m_pre_decode_time = 0;
		var m_post_decode_time = 0;
		var m_frame_num = 0;
		self.addEventListener('message', e => {
			var data = e.data;
			if (!m_active_frame) {
				if (data[0] == 0xFF && data[1] == 0xD8) { // SOI
					m_active_frame = [];
					m_active_frame_st = new Date().getTime();
				}
			}
			if (m_active_frame) {
				m_active_frame.push(data);
				if (data[data.length - 2] == 0xFF && data[data.length - 1] == 0xD9) { // EOI
					var time_ms = 0;
					var pre_decode_time = new Date().getTime() - m_active_frame_st;
					if(m_pre_decode_time == 0){
						m_pre_decode_time = pre_decode_time;
					}else{
						m_pre_decode_time = m_pre_decode_time*0.9 + pre_decode_time*0.1;
					}
					if((m_frame_num % 100) == 0){
						console.log("MJPEG pre dcode time : " + m_pre_decode_time + "ms");
					}
					
					var frame_info = "";
					if (m_active_frame[0][2] == 0xFF && m_active_frame[0][3] == 0xE1) { // xmp
						frame_info = String.fromCharCode.apply("", m_active_frame[0].subarray(6), 0);
						m_active_frame[0] = SOIMARKER;

						var map = [];
						var split = frame_info.split(' ');
						for (var i = 0; i < split.length; i++) {
							var separator = (/[=,\"]/);
							var _split = split[i].split(separator);
							map[_split[0]] = _split;
						}
						if(map['timestamp']){
							time_ms = parseInt(map['timestamp'][2])*1000 + parseInt(map['timestamp'][3])/1000;
						}
					}

					var blob = new Blob(m_active_frame, {
						type : "image/jpeg"
					});
					var active_frame_st = m_active_frame_st;
					createImageBitmap(blob).then(image => {
						image.codec = 'jpeg';
						
						var post_decode_time = new Date().getTime() - active_frame_st;
						if(m_post_decode_time == 0){
							m_post_decode_time = post_decode_time;
						}else{
							m_post_decode_time = m_post_decode_time*0.9 + post_decode_time*0.1;
						}
						if((m_frame_num % 100) == 0){
							console.log("MJPEG post dcode time : " + m_post_decode_time + "ms");
						}
						m_frame_num++;
						
						self.postMessage({ type:'image', frame_info, image, time : time_ms }, [image]);
					});

					m_active_frame = null;
				}
			}
	    });
	});
	
	worker.addEventListener('message', res =>{
		if (m_frame_callback) {
			m_frame_callback("image", res.data.image, 0, 0, res.data.frame_info, res.data.time);
		}
	});
	var m_mjpeg = false;
	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		// @data : Uint8Array
		decode : function(data, data_len) {
			if (data[0] == 0xFF && data[1] == 0xD8) { // SOI
				m_mjpeg = true;
			}
			if(m_mjpeg){
				worker.postMessage(data, [data.buffer]);
			}
		}
	};
	return self;
}