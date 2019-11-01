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
		var m_latency = 0;

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
		var m_texture_fps = 0;
		var m_texture_num = 0;
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
		var m_image_decode_blocking = false;

		// omvr vars
		var m_worker = null;
		var m_omvr = null;

		// texture info
		var m_texture_fov = 90;

		// params
		var stereoEnabled = false;
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
			 horizon_opt_view_quaternion : function(view_quat) {
				 if(self.vertex_type.startsWith("picam360map")){
					 var euler = new THREE.Euler(THREE.Math.degToRad(0), THREE.Math
							 .degToRad(45), THREE.Math.degToRad(0), "YXZ");
					 var quat = new THREE.Quaternion().setFromEuler(euler);
					 return view_quat.clone().multiply(quat);
				 }else{
					 return view_quat;
				 }
			},

			fps : 0,
			checkImageDelay : 1000,
			vertex_type : "",
			vertex_type_forcibly : "",
			fragment_type : "",
			skip_frame : 0,

			get_info : function() {
				if(m_omvr) {
					m_latency = m_omvr.get_latency();
				}
				var info = {
					latency : m_latency,
					video_fps : m_texture_fps,
					animate_fps : m_animate_fps,
					codec : self.codec,
					bitrate : self.bitrate,
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
				var uuid;
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
					if (map["uuid"]) {
						uuid = uuidParse.parse(map["uuid"][2]);
					}					
					if(map["codec"]){
						self.codec = map["codec"][2];
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
				self.vertex_type = vertex_type;
				
				{// fps
					if (m_texture_tmp_time == 0) {
						m_texture_tmp_time = now;
					} else if (now - m_texture_tmp_time > 200) {
						var value = (m_texture_num - m_texture_tmp_num) * 1000
							/ (now - m_texture_tmp_time);
						if(m_texture_fps == 0){
							m_texture_fps = value;
						}else{
							m_texture_fps = m_texture_fps * 0.9 + value * 0.1;
						}
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
				if (type == "raw_bmp") {
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
						m_texture.image = img;
						m_texture.needsUpdate = true;
					};
					// console.log(m_target_texture.src + " : " + blob.size
					// + " : " + m_active_frame.length);
					blob = null;
				} else if (type == "video") {
					m_omvr.setVideoTexture(vertex_type, data, m_tex_quat, m_texture_fov, uuid);
				} else if (type == "yuv") {
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureRawYuv',
							vertex_type, 
							data,
							width,
							height,
							quat : m_tex_quat,
							fov : m_texture_fov,
							uuid,
						}, [data]);
					}else{
						m_omvr.setTextureRawYuv(vertex_type, data, width, height, m_tex_quat, m_texture_fov, uuid);
					}
				} else if (type == "rgb") {
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureRawRgb',
							vertex_type, 
							data,
							quat : m_tex_quat,
							fov : m_texture_fov,
							uuid,
						}, [data]);
					}else{
						m_omvr.setTextureRawRgb(vertex_type, data, m_tex_quat, m_texture_fov, uuid);
					}
				} else if (type == "image") {
					if(m_worker){
						m_worker.postMessage({
							type : 'setTextureImage',
							vertex_type, 
							data,
							quat : m_tex_quat,
							fov : m_texture_fov,
							uuid,
							time,
						}, [data]);
					}else{
						m_omvr.setTextureImage(vertex_type, data, m_tex_quat, m_texture_fov, uuid, time);
					}
				} else if (type == "frame_info") {
					if(m_worker){
						m_worker.postMessage({
							type : 'setFrameInfo',
							vertex_type, 
							quat : m_tex_quat,
							fov : m_texture_fov,
							uuid,
						});
					}else{
						m_omvr.setFrameInfo(vertex_type, m_tex_quat, m_texture_fov, uuid);
					}
				} else if (type == "blob") {
					var img = new Image();
					var url = window.URL || window.webkitURL;
					if (img.src && img.src.indexOf("blob") == 0) {
						url.revokeObjectURL(img.src);
					}
					img.src = url.createObjectURL(data);
					var img_hander = function(value){
						if(m_worker){
							m_worker.postMessage({
								type : 'setTextureImage',
								vertex_type, 
								value,
								quat : m_tex_quat,
								fov : m_texture_fov,
								uuid,
							}, [img]);
						}else{
							m_omvr.setTextureImage(vertex_type, value, m_tex_quat, m_texture_fov, uuid);
						}
					}
					if(m_image_decode_blocking){
						img.onload = function(ev) {
							img_hander(img);
						};
					}else{
						img.decode().then((ev) => {
							img_hander(img);
							setTimeout(function(){
								url.revokeObjectURL(img.src);
							},1000);
						}).catch((err) => {
							console.log(err);
						});
					}
					// console.log(img.src + " : " + blob.size);
				}
			},

			init : function(_options, callback) {
				m_canvas = _options.canvas;

				function _callback() {
					self.updateCanvasSize();
					window.addEventListener('resize', self.updateCanvasSize, false);
					callback();
				}

				async function get_vr_display(){
					if (navigator.getVRDisplays) {
						console.log('WebVR 1.1 supported');
						var displays = await navigator.getVRDisplays();
						if (displays.length > 0) {
							console.log("vr display found");
							m_vr_display = displays[0];
						}
					}
				}
				get_vr_display();
				var options = {
					devicePixelRatio : window.devicePixelRatio,
					antialias : _options.antialias,
					fxaa_enabled : _options.fxaa_enabled,
					mesh_resolution : _options.mesh_resolution,
					vr_margin : _options.vr_margin,
					eye_offset : _options.eye_offset,
				};
				if (!m_vr_display && _options.offscreen && 'transferControlToOffscreen' in m_canvas) {
					console.log('webgl in worker supported');
					m_canvas_act = m_canvas.transferControlToOffscreen();
					options.canvas = m_canvas_act;
					
					m_worker = new Worker(m_base_path
						+ '../lib/omvr/omvr_worker.js');
					m_worker.postMessage({
						type : 'init',
						options,
					}, [m_canvas_act]);
					m_worker
						.addEventListener('message', function(e) {
							if (e.data.type == 'init_done') {
								m_worker
									.removeEventListener('message', arguments.callee);
								_callback();
							}
						});

					self.skip_frame = _options.offscreen_skip_frame || 0;
				} else {
					m_canvas_act = m_canvas;
					options.canvas = m_canvas_act;
					options.callback = _callback;
					
					var script = document.createElement('script');
					script.onload = function() {
						m_omvr = new OMVR();
						m_omvr.init(options);
					};
					script.src = m_base_path + '../lib/omvr/omvr.js';

					document.head.appendChild(script);

					self.skip_frame = _options.skip_frame || 0;
				}
			},

			codec : '',
			bitrate : 0,
			set_stream: function(obj, receiver) {
				{// stats
					var last_timestamp = 0;
					var last_bytesReceived = 0;
					setInterval(() => {
						var items = [];
						receiver.getStats().then(stats =>{
							stats.forEach(function(r) {
								items.push(r);
								if(r.id.startsWith('RTCCodec')){
									self.codec = r.mimeType;
								}
								if(r.id.startsWith('RTCTransport')){
									var bitrate = 8*(r.bytesReceived - last_bytesReceived) / (r.timestamp - last_timestamp) * 1000;
									last_timestamp = r.timestamp;
									last_bytesReceived = r.bytesReceived;
									self.bitrate = self.bitrate * 0.8 + 0.2 * bitrate;
								}
							});
						});
					},500);
				}
				if (m_worker) {
					if(!window.createImageBitmap) {
						alert("The offscreen mode needs to support ImageBitmap");
						return;
					}
					m_receiver = receiver;
					m_video = document.createElement('video');
					m_video.crossOrigin = "*";
					m_video.muted = true;
					m_video.playsInline = true;
					
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
						var pixels = ctx.getImageData(0,0, 32, 2).data;
						var uuid = new Uint8Array(16);
						for(var k=0;k<16;k++){
							var val = 0;
							for(var i=0;i<2;i++){
								for(var j=0;j<2;j++){
									var idx = (32*i + k*2 + j)*4;
									val += 0.299*pixels[idx+0]+0.587*pixels[idx+1]+0.114*pixels[idx+2];
								}
							}
							uuid[k] = val / 4;
						}
						return uuid;
					}
					function start_video_poling(){
						var last_currentTime = m_video.currentTime;
						var last_uuid = new Uint8Array(16);
						setInterval(function() {
							// var st = new Date().getTime();
							var currentTime = m_video.currentTime;
							if(currentTime == last_currentTime){
								return;
							}else{
								last_currentTime = currentTime;
							}
							if(!m_videoImage){
								m_videoImage = document.createElement('canvas');
								m_videoImage.width = m_video.videoWidth;
								m_videoImage.height = m_video.videoHeight;
								m_videoImageContext = m_videoImage.getContext('2d');
								m_videoImageContext.fillStyle = '#000000';
								m_videoImageContext.fillRect(0, 0, m_videoImage.width, m_videoImage.height);
							}
							window.createImageBitmap(m_video).then(imageBitmap => {
								m_videoImageContext.drawImage(imageBitmap, 0, 0, 32, 2, 0, 0, 32, 2);
								var uuid = get_uuid_from_canvas(m_videoImageContext);
								if (uuid_abs(last_uuid, uuid) == 0) {
									return;
								}else{
									last_uuid = uuid;
								}
								// console.log("img:"+uuid);
								m_worker.postMessage({
									type : 'setFrameImage',
									img : imageBitmap,
									uuid,
								}, [imageBitmap]);
							});
							// var et = new Date().getTime();
							// console.log("time:"+(et-st));
						}, 10); // 100hz
					}
// function init_video(){
// if(!m_need_to_push){
// try{
// var uuid_zero = new Uint8Array(16);
// m_videoImageContext.drawImage(m_video, 0, 0, 16, 1, 0, 0, 16, 1);
// var uuid = get_uuid_from_canvas(m_videoImageContext);
// if (uuid_abs(uuid_zero, uuid) == 0){
// m_need_to_push = true;
// }
// }catch{
// m_need_to_push = true;
// }
// }
// if (m_need_to_push) {//need to play
// function createButton(text, x, y, context, func) {
// var button = document.createElement("input");
// button.type = "button";
// button.value = text;
// button.style.position = 'absolute';
// button.style.left = window.innerWidth * x + 'px';
// button.style.top = window.innerHeight * y + 'px';
//			
// button.onclick = func;
// context.appendChild(button);
// }
// createButton('video start', 0.5, 0.5, document.body, (e) => {
// m_video.play().catch((err) => {
// console.log(err);
// });
// start_video_poling();
// document.body.removeChild(e.srcElement);
// });
// } else {
// start_video_poling();
// }
// }
					function try_play() {
						m_video.play().then(()=>{
						}).catch((err) =>{
							console.log(err);
						}).finally(() =>{
							m_can_play = true;
							start_video_poling();
						});
					}
					var timeout = setTimeout(function(){
						console.log("video play event timeout!");
						m_need_to_push = true;
						timeout = null;
						try_play();
					}, 2000);
					m_video.addEventListener("canplay", function(){
						if(timeout){
							console.log("video canplay!");
							clearTimeout(timeout);
							timeout = null;
							try_play();
							m_video.removeEventListener("canplay", arguments.callee, false);
						}
					});
					m_video.srcObject = obj;
					m_video.load();
				} else {
					m_omvr.set_stream(obj, receiver);
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
				// console.log(self.view_quat._x+":"+self.view_quat._y+":"+self.view_quat._z+";");
				return self.view_quat.clone();// clone() necessary no to be
												// changed
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
						var w = Math.max(
									m_vr_display.getEyeParameters("left").renderWidth,
									m_vr_display.getEyeParameters("right").renderWidth) * 2;
						var h = Math.max(
									m_vr_display.getEyeParameters("left").renderHeight,
									m_vr_display.getEyeParameters("right").renderHeight);
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
				self.updateCanvasSize();
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