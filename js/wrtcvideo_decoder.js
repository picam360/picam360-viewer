function WRTCVideoDecoder(callback) {
	var m_active_frame = null;
	var m_frame_callback = null;

	var m_packet_frame_num = 0;
	var m_decoded_frame_num = 0;
	var m_frame_info = {};

	var m_image_capture = null;
	var m_video = null;
	var m_receiver = null;

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

	var is_init = false;
	var info = {};
	var packet_pool = [];

	var self = {
		set_stream : function(obj, receiver) {
			m_receiver = receiver;
			m_video = document.createElement('video');
			m_video.crossOrigin = "*";
			m_video.srcObject = obj;
			m_video.load();
			
			var agent = window.navigator.userAgent.toLowerCase();
			if(window.ImageCapture && agent.indexOf('oculus') === -1){
				m_image_capture = new ImageCapture(obj.getVideoTracks()[0]);
			}else{
				m_image_capture = new _ImageCapture(obj.getVideoTracks()[0]);
			}
			if(agent.indexOf('firefox') !== -1){
				m_video.play_required = true;
				function on_play(e){
					m_video.play();
					m_video.play_called = true;
					document.removeEventListener('touchstart', on_play);
					document.removeEventListener('mousedown', on_play);
				}
				document.addEventListener("touchstart", on_play);
				document.addEventListener("mousedown", on_play);
			}
// var last_timeStamp = 0;
// var frame_num=0;
// var reciever_stats = null;
// setInterval(function(){
// receiver.getStats().then(stats => {
// stats.forEach(function(item, prop) {
// if(prop.startsWith('RTCMediaStreamTrack_receiver_')){
// console.log(m_video.webkitDecodedFrameCount + ":"+item.framesDecoded+
// ":"+item.framesDropped);
// reciever_stats = item;
// }
// });
// });
// }, 100);
// setInterval(function(){
// console.log(m_video.webkitDecodedFrameCount + ":"+m_video.currentTime);
// },50);
// m_video.addEventListener('timeupdate', (event) => {
// frame_num++;
// console.log('video:'+frame_num+':'+(event.timeStamp-last_timeStamp));
// last_timeStamp = event.timeStamp;
// });
// var container = document.getElementById("container");
// container.appendChild(m_video);
		},
		set_frame_callback : function(callback) {
			m_frame_callback = callback;
		},
		init : function() {
		},
		// @data : Uint8Array
		decode : function(data) {
			if (!is_init) {
				is_init = true;
				self.init();
			}
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
			if (m_active_frame
				&& (data[data.length - 2] == 0x32 && data[data.length - 1] == 0x30)) {// EOI
				try {
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
						if (!mode) {
							return;
						}
						m_packet_frame_num++;
						m_frame_info[m_packet_frame_num] = {
							info : str,
							time : new Date().getTime()
						};
						if(m_video.play_required && !m_video.play_called){
							return;
						}
						if (m_image_capture.requested) {
							return;
						} else {
							m_image_capture.requested = true;
						}
						function on_image_captured(imageBitmap, drop){
							m_image_capture.requested = false;						
							// m_decoded_frame_num =
							// m_video.webkitDecodedFrameCount;
							m_decoded_frame_num = m_packet_frame_num - drop - 1;
							// console.log("m_decoded_frame_num:" +
							// m_decoded_frame_num);
							if (m_decoded_frame_num > m_packet_frame_num) {
								console.log("something wrong");
								m_decoded_frame_num--; // fail safe
								return;
							}

							if (m_frame_callback) {
								var info = m_frame_info[m_decoded_frame_num];
								if (!info) {
									console.log("no view quat info:"
										+ m_decoded_frame_num + ":"
										+ m_frame_info.length);
								} else {
									m_frame_callback("ImageBitmap", imageBitmap, imageBitmap.width, imageBitmap.height,
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
							// if (m_decoded_frame_num !=
							// m_packet_frame_num) {
							// console.log("packet & decode are not
							// synchronized:"
							// + m_decoded_frame_num + "-" +
							// m_packet_frame_num);
							// }
						}
						m_image_capture.grabFrame()
						  .then(imageBitmap => {
//								m_receiver.getStats().then(stats => {
//									 stats.forEach(function(item, prop) {
//										 if(prop.startsWith('RTCMediaStreamTrack_receiver_')){
//										 	 console.log(item.framesDecoded+":"+item.framesDropped);
//										 	 on_image_captured(imageBitmap, item.framesDropped);
//										 }
//									 });
//								});
							  	on_image_captured(imageBitmap, 0);
						  })
						  .catch(error => console.log(error));
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
