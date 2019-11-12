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
					var blob = new Blob(m_active_frame, {
						type : "image/jpeg"
					});
					var active_frame_st = m_active_frame_st;
					createImageBitmap(blob).then(image => {
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
						
						self.postMessage(image, [image]);
					});

					m_active_frame = null;
				}
			}
	    });
	});
	
	worker.addEventListener('message', res =>{
		if (m_frame_callback) {
			m_frame_callback(res.data);
		}
	});
	var m_mjpeg = false;
	var self = {
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		// @data : Uint8Array
		decode : function(data, end_of_frame) {
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