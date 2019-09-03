function WRTCVideoDecoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_packet_frame_num = 0;
	var m_decoded_frame_num = 0;
	var m_frame_info = {};
	var m_delay_img = null;

	var m_image_capture = null;
	var m_video = null;
	var m_videoImage = null;
	var m_videoImageContext = null;
	var m_receiver = null;
	
	function uuid_abs(uuid1, uuid2){
		var sum = 0;
		for(var i=0;i<uuid1.length;i++){
			sum += Math.abs(uuid1[i]-uuid2[i]);
		}
		return sum;
	}
	function uuid_ncc(uuid1, uuid2){
		var sum1 = 0;
		var sum2 = 0;
		var sum12 = 0;
		for(var i=0;i<uuid1.length;i++){
			sum1 += uuid1[i]*uuid1[i];
			sum2 += uuid2[i]*uuid2[i];
			sum12 += uuid1[i]*uuid2[i];
		}
		return sum12 / Math.sqrt(sum1*sum2);
	}
	
	function get_uuid_from_canvas(ctx){
		var uuid = new Uint8Array(16);
		var apx = ctx.getImageData(0,0, 16, 1);
		for(var i=0;i<16;i++){
			uuid[i] = 0.299*apx.data[i*4+0]+0.587*apx.data[i*4+1]+0.114*apx.data[i*4+2];
		}
		return uuid;
	}
	
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

	var m_is_init = false;
	var m_first_frame = false;
	var m_can_play = false;
	var info = {};
	var packet_pool = [];

	var self = {
		new_image_handler: function(image_data) {
			if(!Object.keys(m_frame_info).length){
				m_delay_img = image_data;
				return;
			}
			var max_i = m_decoded_frame_num;
			var max_ncc = 0;
			for(var i in m_frame_info){
				var ncc = uuid_ncc(m_frame_info[i].uuid, image_data.uuid);
				if(ncc > max_ncc){
					max_ncc = ncc;
					max_i = i;
				}
			}
			m_decoded_frame_num = parseInt(max_i);

			if (m_frame_callback) {
				var info = m_frame_info[m_decoded_frame_num];
				if (!info) {
					console.log("no view quat info:" +
						m_decoded_frame_num + ":" +
						m_frame_info.length);
				} else {
					m_frame_callback("image", image_data, image_data.width, image_data.height,
						info.info, info.time);
				}
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
		},
		init: function() {
			if (!m_is_init && m_first_frame && m_can_play) {
				m_is_init = true;

				m_videoImage = document.createElement('canvas');
				m_videoImage.width = m_video.videoWidth;
				m_videoImage.height = m_video.videoHeight;
				m_videoImageContext = m_videoImage.getContext('2d');
				m_videoImageContext.fillStyle = '#000000';
				m_videoImageContext.fillRect(0, 0, m_videoImage.width, m_videoImage.height);

				function start_video_poling(){
					var last_currentTime = m_video.currentTime;
					var last_uuid = new Uint8Array(16);
					setInterval(function() {
						//var st = new Date().getTime();
						var currentTime = m_video.currentTime;
						if(currentTime == last_currentTime){
							return;
						}else{
							last_currentTime = currentTime;
						}
						if(window.createImageBitmap) {
							window.createImageBitmap(m_video).then(imageBitmap => {
								m_videoImageContext.drawImage(imageBitmap, 0, 0, 16, 1, 0, 0, 16, 1);
								var uuid = get_uuid_from_canvas(m_videoImageContext);
								imageBitmap.uuid = uuid;
								self.new_image_handler(imageBitmap);
							});
						} else { // imagedata not work in offscreen
							m_videoImageContext.drawImage(m_video, 0, 0, m_videoImage.width, m_videoImage.height);
							var uuid = get_uuid_from_canvas(m_videoImageContext);
							if (uuid_abs(last_uuid, uuid) == 0) {
								return;
							}else{
								last_uuid = uuid;
							}
							var image_data = m_videoImageContext.getImageData(0, 0, m_videoImage.width, m_videoImage.height);
							image_data.uuid = uuid;
							self.new_image_handler(image_data);
						}
						//var et = new Date().getTime();
						//console.log("time:"+(et-st));
					}, 10); // 100hz
				}

				var uuid_zero = new Uint8Array(16);
				m_videoImageContext.drawImage(m_video, 0, 0, 16, 1, 0, 0, 16, 1);
				var uuid = get_uuid_from_canvas(m_videoImageContext);
				if (uuid_abs(uuid_zero, uuid) == 0) {//need to play
					function createButton(text, x, y, context, func) {
						var button = document.createElement("input");
						button.type = "button";
						button.value = text;
						button.style.position = 'absolute';
						button.style.left = window.innerWidth * x + 'px';
						button.style.top = window.innerHeight * y + 'px';
	
						button.onclick = func;
						context.appendChild(button);
					}
					createButton('video start', 0.5, 0.5, document.body, (e) => {
						m_video.play().catch((err) => {
							console.log(err);
						});
						start_video_poling();
						document.body.removeChild(e.srcElement);
					});
				} else {
					start_video_poling();
				}
			}
		},
		set_stream: function(obj, receiver) {
			m_receiver = receiver;
			m_video = document.createElement('video');
			m_video.crossOrigin = "*";
			m_video.srcObject = obj;
			m_video.muted = true;
			m_video.playsInline = true;
			m_video.load();

			m_video.addEventListener("canplay", function() {
				console.log("video canplay!");
				m_video.play().then(()=>{
				}).catch((err) =>{
					console.log(err);
				}).finally(() =>{
					m_can_play = true;
					self.init();
				});
				m_video.removeEventListener("canplay", arguments.callee, false);
			});
		},
		set_frame_callback: function(callback) {
			m_frame_callback = callback;
		},
		// @data : Uint8Array
		decode: function(data) {
			if (!m_active_frame) {
				if (data[0] == 0x49 && data[1] == 0x34) { // SOI
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
			if (m_active_frame &&
				(data[data.length - 2] == 0x32 && data[data.length - 1] == 0x30)) { // EOI
				try {
					var nal_type = 0;
					var nal_len = 0;
					var _nal_len = 0;
					if (((m_active_frame[0][4] & 0x7e) >> 1) == 40) { // sei
						var str = String.fromCharCode.apply("", m_active_frame[0]
							.subarray(4), 0);
						var split = str.split(' ');
						var uuid = null;
						for (var i = 0; i < split.length; i++) {
							var separator = (/[=,\"]/);
							var _split = split[i].split(separator);
							if (_split[0] == "uuid") {
								uuid = _split[2];
							}
						}
						if (!uuid) {
							return;
						}
						m_packet_frame_num++;
						m_frame_info[m_packet_frame_num] = {
							info: str,
							time: new Date().getTime(),
							uuid: uuidParse.parse(uuid),
						};
						if (!m_first_frame) {
							m_first_frame = true;
							self.init();
						}
						if(m_delay_img){
							self.new_image_handler(m_delay_img);
							m_delay_img = null;
						}
						// console.log("packet_frame_num:" +
						// m_packet_frame_num
						// + ":" + str);
					}
				} finally {
					m_active_frame = null;
				}
			} // if
		}, // decode
	}; // self
	return self;
}