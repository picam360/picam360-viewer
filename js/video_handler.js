(function() {

	var m_base_path = (function() {
		var path = document.currentScript.src.split('?')[0];
		var mydir = path.split('/').slice(0, -1).join('/') + '/';
		return mydir;
	})();

	function gotoTop() {
		document.body.scrollTop = 0;
		document.documentElement.scrollTop = 0;
	}

	function isSmartphone() {
		var user = "";
		if ((navigator.userAgent.indexOf('iPhone') > 0 && navigator.userAgent
			.indexOf('iPad') == -1)
			|| navigator.userAgent.indexOf('iPod') > 0
			|| navigator.userAgent.indexOf('Android') > 0) {
			return true;
		} else {
			return false;
		}
	}

	function splitExt(filename) {
		return filename.split(/\.(?=[^.]+$)/);
	}

	function VideoHandler() {
		var m_canvas;
		var m_canvas_act;

		// focal point tune
		var m_view_quat = new THREE.Quaternion();
		var m_tex_quat = new THREE.Quaternion();
		
// var m_view_quat_1 = new THREE.Quaternion();
// var m_view_tex_diff_quat = new THREE.Quaternion();
// var m_view_quat_1_time = new Date().getTime();
// var m_view_quat_time = new Date().getTime();
// var m_view_av_rad = 0;
// var m_view_av_n = new THREE.Vector3(0, 0, 1);

		// diagnotics
		var m_texture_latency = 0;
		var m_texture_fps = 0;
		var m_texture_num = 0;
		var m_texture_idle_time = 0;
		var m_texture_processed = 0;
		var m_texture_encoded = 0;
		var m_texture_decoded = 0;
		var m_texture_tmp_time = 0;
		var m_texture_tmp_num = 0;
		
		var m_animate_fps = 0;
		var m_animate_called_num = 0;
		var m_animate_num = 0;
		var m_animate_tmp_time = 0;
		var m_animate_tmp_num = 0;

		// texture related
		var m_videoImage;
		var m_videoImageContext;
		var m_video;
		var m_videoStart = 0;

		// omvr vars
		var m_worker = null;
		var m_omvr = null;

		// texture info
		var m_texture_fov = 90;
		var m_texture_width = 512;
		var m_texture_height = 512;

		// params
		var stereoEnabled = false;
		var m_limit_fov = 180;
		var m_vr_mode = false;
		var m_requestAnimationFrame_target = window;
		
		// webvr
		var m_vr_display = null;

		var self = {
			updateCanvasSize : function() {
// var w = Math.abs(window.orientation || 0) != 90
// ? window.innerWidth
// : window.innerHeight;
// var h = Math.abs(window.orientation || 0) != 90
// ? window.innerHeight
// : window.innerWidth;
				var w = window.innerWidth;
				var h = window.innerHeight;
				m_canvas.width = w;
				m_canvas.height = h;

				if(m_worker){
					m_worker.postMessage({
						type : 'setCanvasSize',
						width : w,
						height : h,
					});
				}else if(m_omvr){
					m_omvr.setCanvasSize(w, h);
				}

				console.log("updateCanvasSize : " + w + "," + h);
	
				gotoTop();
			},
// set_view_quaternion : function(value) {
// m_view_quat_1 = m_view_quat;
// m_view_quat_1_time = m_view_quat_time;
// m_view_quat = value;
// m_view_quat_time = new Date().getTime();
//
// var diff_time = (m_view_quat_time - m_view_quat_1_time) / 1000;
// var diff_quat = m_view_quat_1.clone().conjugate()
// .multiply(m_view_quat);
// var cos = diff_quat.w;
// var sin = Math.sqrt(diff_quat.x * diff_quat.x + diff_quat.y
// * diff_quat.y + diff_quat.z * diff_quat.z);
// m_view_av_rad = (Math.atan2(sin, cos) * 2) / diff_time;
// // console.log("cos:" + cos + ",sin:" + sin + ",av:"
// // + (180 * m_view_av_rad / Math.PI));
// if (sin == 0) {
// m_view_av_n = new THREE.Vector3(0, 0, 1);
// } else {
// m_view_av_n = new THREE.Vector3(diff_quat.x / sin, diff_quat.y
// / sin, diff_quat.z / sin);
// }
// },
// predict_view_quaternion : function() {
// var rad = m_view_av_rad * m_texture_latency;
// var cos = Math.cos(rad / 2);
// var sin = Math.sin(rad / 2);
// var diff_quat = new THREE.Quaternion(sin * m_view_av_n.x, sin
// * m_view_av_n.y, sin * m_view_av_n.z, cos);
// return m_view_quat.clone().multiply(diff_quat);
// },
// get_adaptive_texture_fov : function() {
// var diff_quat = m_view_tex_diff_quat;
// var cos = diff_quat.w;
// var sin = Math.sqrt(diff_quat.x * diff_quat.x + diff_quat.y
// * diff_quat.y + diff_quat.z * diff_quat.z);
// var diff_theta = Math.atan2(sin, cos) * 2;
// while (Math.abs(diff_theta) > Math.PI) {
// if (diff_theta > 0) {
// diff_theta -= 2 * Math.PI;
// } else {
// diff_theta += 2 * Math.PI;
// }
// }
// var fov = m_view_fov + 180 * Math.abs(diff_theta) / Math.PI;
// fov = Math.round(fov / 5) * 5;
// if (fov > m_limit_fov) {
// fov = m_limit_fov;
// }
// return fov;
// },

			fps : 0,
			checkImageDelay : 1000,
			vertex_type : "",
			vertex_type_forcibly : "",
			fragment_type : "",
			skip_frame : 0,

			get_info : function() {
				var rtt = m_texture_latency - m_texture_processed
					- m_texture_encoded - m_texture_decoded;
				var info = {
					latency : m_texture_latency,
					video_fps : m_texture_fps,
					animate_fps : m_animate_fps,
					idle_time : m_texture_idle_time,
					processed : m_texture_processed,
					encoded : m_texture_encoded,
					decoded : m_texture_decoded,
					rtt : rtt,
					offscreen : (m_worker != null),
				};
				return info;
			},

			loadTexture : function(image_url, image_type) {
				if (!image_type) {
					image_type = splitExt(image_url.split('?')[0])[1]
						.toLowerCase();
				}
				switch (image_type) {
					case 'video' :
					case 'mp4' :
						m_video = document.createElement('video');
						m_video.crossOrigin = "Anonymous";
						m_video.src = image_url;
						m_video.load();
						if (isSmartphone()) {
							m_video
								.addEventListener("canplay", function() {
									console.log("video canplay!");
									m_videoImage = document
										.createElement('canvas');
									m_videoImage.width = m_video.videoWidth;
									m_videoImage.height = m_video.videoHeight;
									m_videoImageContext = m_videoImage
										.getContext('2d');
									m_videoImageContext.fillStyle = '#000000';
									m_videoImageContext
										.fillRect(0, 0, m_videoImage.width, m_videoImage.height);
									m_texture = new THREE.Texture(m_videoImage);
									setTextureFunc(m_texture);
									m_video
										.removeEventListener("canplay", arguments.callee, false);
								}, false);
						} else {
							m_video.autoplay = true;
							m_video.loop = true;
							m_video.crossOrigin = '*';
							setTextureFunc(new THREE.VideoTexture(m_video));
						}
						break;
					case 'jpg' :
					case 'jpeg' :
					case 'png' :
					case 'image' :
					default :
						var img = new Image();
						img.onload = function() {
							self.setTextureImg(img);
						}
						img.crossOrigin = '*';
						img.src = image_url;
						break;
				}
			},

			handle_frame : function(type, data, width, height, info, time) {
				m_texture_num++;

				var now = new Date().getTime();
				var tex_quat;
				var vertex_type = self.vertex_type;
				if (info) {
					var map = [];
					var split = info.split(' ');
					for (var i = 0; i < split.length; i++) {
						var separator = (/[=,\"]/);
						var _split = split[i].split(separator);
						map[_split[0]] = _split;
					}
					if (map["view_quat"]) { // view quaternion
						var x = parseFloat(map["view_quat"][2]);
						var y = parseFloat(map["view_quat"][3]);
						var z = parseFloat(map["view_quat"][4]);
						var w = parseFloat(map["view_quat"][5]);
						tex_quat = new THREE.Quaternion(x, y, z, w);
					}
					if (map["fov"]) {
						m_texture_fov = parseFloat(map["fov"][2]);
					}
					if (map["client_key"]) { // latency
						var idle_time = 0;
						if (map["idle_time"]) {
							idle_time = parseFloat(map["idle_time"][2]);
						}
						var value = (now - parseFloat(map["client_key"][2]))
							/ 1000 - idle_time;
						if (!isNaN(value)) {
							m_texture_latency = m_texture_latency * 0.9 + value
								* 0.1;
						}
					}
					if (map["idle_time"]) {
						var value = parseFloat(map["idle_time"][2]);
						m_texture_idle_time = m_texture_idle_time * 0.9 + value
							* 0.1;
					}
					if (map["frame_processed"]) {
						var value = parseFloat(map["frame_processed"][2]);
						m_texture_processed = m_texture_processed * 0.9 + value
							* 0.1;
					}
					if (map["encoded"]) {
						var value = parseFloat(map["encoded"][2]);
						m_texture_encoded = m_texture_encoded * 0.9 + value
							* 0.1;

					}
					{// decoded
						var decoded = (now - time) / 1000;
						m_texture_decoded = m_texture_decoded * 0.9 + decoded
							* 0.1;
					}
					if (map["mode"]) {
						switch (map["mode"][2]) {
							case "WINDOW" :
							case "EQUIRECTANGULAR" :
							case "PICAM360MAP" :
							case "PICAM360MAP3D" :
								vertex_type = map["mode"][2].toLowerCase();
								break;
							default :
								vertex_type = "window";
						}
					}
				}
				if (self.vertex_type_forcibly) {
					vertex_type = self.vertex_type_forcibly;
				}
				{// fps
					if (m_texture_tmp_time == 0) {
						m_texture_tmp_time = now;
					} else if (now - m_texture_tmp_time > 200) {
						var value = (m_texture_num - m_texture_tmp_num) * 1000
							/ (now - m_texture_tmp_time);
						m_texture_fps = m_texture_fps * 0.9 + value * 0.1;
						m_texture_tmp_num = m_texture_num;
						m_texture_tmp_time = now;
					}
				}
				if (tex_quat) {
					m_tex_quat = tex_quat;
				} else {
					console.log("no view quat info");
					m_tex_quat = m_view_quat.clone();
				}
				if (vertex_type == "window") {
					m_limit_fov = m_view_fov;
				} else if (vertex_type == "picam360map"
					|| vertex_type == "picam360map3d") {
					m_limit_fov = 180;
				}
				if (type == "raw_bmp") {
					self.setModel(vertex_type, "rgb");

					var img = new Image();
					var header = get_bmp_header(width, height, 32);
					var raw_data = new Uint8Array(data);
					var blob = new Blob([header, raw_data], {
						type : "image/bmp"
					});
					var url = window.URL || window.webkitURL;
					if (img.src && img.src.indexOf("blob") == 0) {
						url.revokeObjectURL(img.src);
					}
					img.src = url.createObjectURL(blob);
					img.onload = function(ev) {
						m_texture_width = img.width;
						m_texture_height = img.height;

						m_texture.image = img;
						m_texture.needsUpdate = true;
					};
					// console.log(m_target_texture.src + " : " + blob.size
					// + " : " + m_active_frame.length);
					blob = null;
				} else if (type == "video") {
					m_texture_width = width;
					m_texture_height = height;
					m_omvr.setVideoTexture(vertex_type, data, m_tex_quat, m_texture_fov);
				} else if (type == "yuv") {
					m_texture_width = width;
					m_texture_height = height;
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureRawYuv',
							vertex_type, 
							data,
							width,
							height,
							quat : m_tex_quat,
							fov : m_texture_fov,
						}, [data]);
					}else{
						m_omvr.setTextureRawYuv(vertex_type, data, width, height, m_tex_quat, m_texture_fov);
					}
				} else if (type == "rgb") {
					m_texture_width = width;
					m_texture_height = height;
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureRawRgb',
							vertex_type, 
							data,
							quat : m_tex_quat,
							fov : m_texture_fov,
						}, [data]);
					}else{
						m_omvr.setTextureRawRgb(vertex_type, data, m_tex_quat, m_texture_fov);
					}
				} else if (type == "image") {
					m_texture_width = width;
					m_texture_height = height;
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureImage',
							vertex_type, 
							data,
							quat : m_tex_quat,
							fov : m_texture_fov,
						}, [data]);
					}else{
						m_omvr.setTextureImage(vertex_type, data, m_tex_quat, m_texture_fov);
					}
				} else if (type == "blob") {
					self.setModel(vertex_type, "rgb");

					var img = new Image();
					var url = window.URL || window.webkitURL;
					if (img.src && img.src.indexOf("blob") == 0) {
						url.revokeObjectURL(img.src);
					}
					img.src = url.createObjectURL(data);
					img.onload = function(ev) {
						m_texture_width = img.width;
						m_texture_height = img.height;

						m_texture.image = img;
						m_texture.needsUpdate = true;
					};
					// console.log(img.src + " : " + blob.size);
				}
			},

			init : async function(options, callback) {
				m_canvas = options.canvas;

				function _callback() {
					self.updateCanvasSize();
					window.addEventListener('resize', self.updateCanvasSize, false);
					callback();
				}

				if (navigator.getVRDisplays) {
					console.log('WebVR 1.1 supported');
					var displays = await navigator.getVRDisplays();
					if (displays.length > 0) {
						console.log("vr display found");
						m_vr_display = displays[0];
					}
				}
				if (!m_vr_display && options.offscreen && 'transferControlToOffscreen' in m_canvas) {
					console.log('webgl in worker supported');
					m_canvas_act = m_canvas.transferControlToOffscreen();
					m_worker = new Worker(m_base_path
						+ '../lib/omvr/omvr_worker.js');
					m_worker.postMessage({
						type : 'init',
						canvas : m_canvas_act,
						devicePixelRatio : window.devicePixelRatio
					}, [m_canvas_act]);
					m_worker
						.addEventListener('message', function(e) {
							if (e.data.type == 'init_done') {
								m_worker
									.removeEventListener('message', arguments.callee);
								_callback();
							}
						});

					self.skip_frame = options.offscreen_skip_frame || 0;
				} else {
					m_canvas_act = m_canvas;
					
					var script = document.createElement('script');
					script.onload = function() {
						m_omvr = new OMVR();
						m_omvr.init(m_canvas_act, window.devicePixelRatio, _callback);
					};
					script.src = m_base_path + '../lib/omvr/omvr.js';

					document.head.appendChild(script);

					self.skip_frame = options.skip_frame || 0;
				}
			},

			getTextureImg : function() {
				return m_videoImage;
			},

			setTextureImg : function(texture) {
			},

			setModel : function(vertex_type, fragment_type) {
				if (m_worker) {

				} else {
					m_omvr.setModel(vertex_type, fragment_type);
				}
			},
			
			get_view_quaternion_vr : function(){
				if(!m_vr_display){
					return new THREE.Quaternion();
				}
				var frameData = new VRFrameData();
				m_vr_display.getFrameData(frameData);
				var m = new THREE.Matrix4();
				m.elements = frameData.leftViewMatrix;
				var quat = new THREE.Quaternion().setFromRotationMatrix(m);
				var view_quat = new THREE.Quaternion(-quat.x, -quat.z, quat.y, quat.w);
				var euler_correct = new THREE.Euler(THREE.Math
					.degToRad(90), THREE.Math.degToRad(0), THREE.Math
					.degToRad(0), "YXZ");
				var quat_correct = new THREE.Quaternion().setFromEuler(euler_correct);
				view_quat = quat_correct.clone().multiply(view_quat);
				return view_quat;
			},
			
			get_view_quaternion_normal : function(){
				return new THREE.Quaternion();
			},
			
			view_quat : new THREE.Quaternion(),
			get_view_quaternion : function(){
				//console.log(self.view_quat._x+":"+self.view_quat._y+":"+self.view_quat._z+";");
				return self.view_quat.clone();//clone() necessary no to be changed
			},

			animate : function(fov) {
				m_animate_called_num++;
				if (!self.get_vr_mode() && (m_animate_called_num % (self.skip_frame + 1)) != 0) {
					return;
				}
				m_animate_num++;
				{// fps
					var now = new Date().getTime();
					if (m_animate_tmp_time == 0) {
						m_animate_tmp_time = now;
					} else if (now - m_animate_tmp_time > 200) {
						var value = (m_animate_num - m_animate_tmp_num) * 1000
							/ (now - m_animate_tmp_time);
						m_animate_fps = m_animate_fps * 0.9 + value * 0.1;
						m_animate_tmp_num = m_animate_num;
						m_animate_tmp_time = now;
					}
				}
				if(m_requestAnimationFrame_target == m_vr_display){
					self.view_quat = self.get_view_quaternion_vr();
				}else{
					self.view_quat = self.get_view_quaternion_normal();
				}
				if (m_worker) {
					m_worker.postMessage({
						type : 'animate',
						fov,
						quat : self.view_quat,
					});
				} else {
					m_omvr.animate(fov, self.view_quat);
				}
				if(m_requestAnimationFrame_target == m_vr_display){
					m_vr_display.submitFrame();
				}
			},

			requestAnimationFrame : function(callback) {
				if(m_vr_mode && m_vr_display){
					m_requestAnimationFrame_target = m_vr_display;
				}else{
					m_requestAnimationFrame_target = window;
				}
				m_requestAnimationFrame_target.requestAnimationFrame(callback);
			},
			
			setVRMode : function(value){
				if(!self.vr_supported()){
					return;
				}
				if(value){
					m_vr_display.requestPresent([{
						source: m_canvas_act
					}]).then(() => {
						m_vr_mode = true;
						// self.updateCanvasSize();//calling timing is not here
						var w = m_canvas.width;
						var h = m_canvas.height;
						w = 2400;
						h = 1353;
						if(m_worker){
							m_worker.postMessage({
								type : 'setCanvasSize',
								width : w,
								height : h,
							});
						}else if(m_omvr){
							m_omvr.setCanvasSize(w, h);
						}
					}).catch(err => {
						console.log(err);
					});
				}else{
					m_vr_display.exitPresent().then(() => {
						m_vr_mode = false;
						self.updateCanvasSize();// calling timing is not here
					});
				}
			},
			
			get_vr_mode : function(){
				return m_vr_mode;
			},
			
			vr_supported : function(){
				return m_vr_display != null;
			},

			setStereoEnabled : function(value) {
				self.setVRMode(value);
				if (m_worker) {
					m_worker.postMessage({
						type : 'setStereoEnabled',
						value,
					});
				} else {
					m_omvr.setStereoEnabled(value);
				}
			}
		};
		return self;
	}
	window.VideoHandler = VideoHandler;
})();