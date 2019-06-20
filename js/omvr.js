/**
 * @author takumadx / http://www.ohmydigifab.com/
 */

function OMVR() {
	var m_view_quat_1 = new THREE.Quaternion();
	var m_view_quat = new THREE.Quaternion();
	var m_tex_quat = new THREE.Quaternion();
	var m_view_tex_diff_quat = new THREE.Quaternion();
	var m_view_quat_1_time = new Date().getTime();
	var m_view_quat_time = new Date().getTime();
	var m_view_av_rad = 0;
	var m_view_av_n = new THREE.Vector3(0, 0, 1);

	var m_table_cache = [];

	var m_camera, m_scene, m_renderer;

	var m_window_mode = false;
	var m_canvas;
	var m_context;

	var m_limit_fov = 180;
	var m_maxfov = 150;
	var m_view_fov = 90;
	var m_texture_fov = 90;
	var m_texture_latency = 0;
	var m_texture_fps = 0;
	var m_texture_num = 0;
	var m_texture_idle_time = 0;
	var m_texture_processed = 0;
	var m_texture_encoded = 0;
	var m_texture_decoded = 0;
	var m_texture_width = 512;
	var m_texture_height = 512;
	var m_videoImage;
	var m_videoImageContext;
	var m_texture;
	var m_texture_y;
	var m_texture_u;
	var m_texture_v;
	var m_video;
	var m_videoStart = 0;

	var m_texture_tmp_time = 0;
	var m_texture_tmp_num = 0;

	var m_yuv_canvas = null;

	// shader
	var m_shaders = {};

	var YUV2RGB = new THREE.Matrix4();

	if (0 == "rec709") {
		// ITU-T Rec. 709
		YUV2RGB.elements = [//
		1.16438, 0.00000, 1.79274, -0.97295,//
		1.16438, -0.21325, -0.53291, 0.30148,//
		1.16438, 2.11240, 0.00000, -1.13340,//
		0, 0, 0, 1,//
		];
	} else {
		// assume ITU-T Rec. 601
		YUV2RGB.elements = [//
		1.16438, 0.00000, 1.59603, -0.87079,//
		1.16438, -0.39176, -0.81297, 0.52959,//
		1.16438, 2.01723, 0.00000, -1.08139,//
		0, 0, 0, 1//
		];
	};

	// audio
	var m_audio_buffer_size = 4096;
	var m_audio_contxt = new (window.AudioContext || window.webkitAudioContext);
	var m_audio_play = false;
	var m_audio_buffer = [];
	var m_audio_buffer_cur = 0;
	var m_sample_rate = 48000;
	var m_sample_resample = Math.round(m_sample_rate
		/ (m_sample_rate - m_audio_contxt.sampleRate));
	var m_sample_count = 0;
	var m_audio_script_proc = m_audio_contxt
		.createScriptProcessor(m_audio_buffer_size, 1, 1);
	m_audio_script_proc.onaudioprocess = function(audioProcessingEvent) {
		var inputBuffer = audioProcessingEvent.inputBuffer;
		var outputBuffer = audioProcessingEvent.outputBuffer;

		var inputData = inputBuffer.getChannelData(0);
		var outputData = outputBuffer.getChannelData(0);

		for (var i = 0; i < outputBuffer.length; i++) {
			var v;
			if (!m_audio_play || m_audio_buffer.length == 0) {
				v = 0;
			} else {
				v = m_audio_buffer[0][0][m_audio_buffer_cur];
				m_audio_buffer_cur++;
				if (m_sample_count % m_sample_resample == 0) {
					m_audio_buffer_cur++;
				}
				if (m_audio_buffer_cur >= m_audio_buffer[0][0].length) {
					m_audio_buffer.shift();
					m_audio_buffer_cur = 0;
				}
			}
			outputData[i] = v;
			m_sample_count++;
		}
	}

	function onWindowResize() {
		m_canvas.width = window.innerWidth;
		m_canvas.height = window.innerHeight;

		m_camera.aspect = window.innerWidth / window.innerHeight;
		m_camera.updateProjectionMatrix();

		m_renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function splitExt(filename) {
		return filename.split(/\.(?=[^.]+$)/);
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

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback(req.responseText);
		}
	}

	function windowGeometry(theta_degree, phi_degree, num_of_steps) {
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.type = 'SphereWindowBufferGeometry';

		var theta = theta_degree * Math.PI / 180.0;
		var phi = phi_degree * Math.PI / 180.0;

		var start_x = -Math.tan(theta / 2);
		var start_y = -Math.tan(phi / 2);

		var end_x = Math.tan(theta / 2);
		var end_y = Math.tan(phi / 2);

		var step_x = (end_x - start_x) / num_of_steps;
		var step_y = (end_y - start_y) / num_of_steps;

		var vertexCount = ((num_of_steps + 1) * (num_of_steps + 1));

		var positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);

		var index = 0, vertices = [];
		for (var i = 0; i <= num_of_steps; i++) {
			var verticesRow = [];
			for (var j = 0; j <= num_of_steps; j++) {
				var x = start_x + step_x * j;
				var y = start_y + step_y * i;
				var z = 1.0;
				var len = Math.sqrt(x * x + y * y + z * z);

				positions.setXYZ(index, x / len, y / len, z / len);

				verticesRow.push(index);

				index++;
			}
			vertices.push(verticesRow);
		}

		var indices = [];
		for (var i = 0; i < num_of_steps; i++) {
			for (var j = 0; j < num_of_steps; j++) {
				var v1 = vertices[i][j + 1];
				var v2 = vertices[i][j];
				var v3 = vertices[i + 1][j];
				var v4 = vertices[i + 1][j + 1];

				indices.push(v1, v2, v4);
				indices.push(v2, v3, v4);
			}
		}

		bufferGeometry.setIndex(new (positions.count > 65535
			? THREE.Uint32Attribute
			: THREE.Uint16Attribute)(indices, 1));
		bufferGeometry.addAttribute('position', positions);

		var geometry = new THREE.Geometry();
		geometry.type = 'SphereWindowGeometry';
		geometry.fromBufferGeometry(bufferGeometry);

		return geometry;
	}

	function quaterSphereGeometry(num_of_steps, offset) {
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.type = 'QuaterSphereBufferGeometry';

		var vertexCount = ((num_of_steps + 1) * (num_of_steps / 4 + 1));

		var positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);

		var pi_idx = 3 * num_of_steps / 4;
		var indices = [];
		var vertices = [];
		var index = 0;
		for (var i = 0; i <= num_of_steps; i++) {
			var theta;
			if (i <= pi_idx) {
				theta = Math.pow(i / pi_idx, 1.5) * (Math.PI / 2);
			} else {
				theta = (Math.PI / 2) / (num_of_steps - pi_idx) * (i - pi_idx)
					+ (Math.PI / 2);
			}
			var verticesRow = [];
			for (var j = 0; j <= num_of_steps / 4; j++) {
				var phi = j * (Math.PI / 2) / (num_of_steps / 4) + offset;
				var x = Math.sin(theta) * Math.cos(phi);
				var y = Math.sin(theta) * Math.sin(phi);
				var z = Math.cos(theta);

				positions.setXYZ(index, x, y, z);

				verticesRow.push(index);

				index++;
			}
			vertices.push(verticesRow);
		}

		for (var i = 0; i < num_of_steps; i++) {
			for (var j = 0; j < num_of_steps; j++) {
				var v1 = vertices[i][j + 1];
				var v2 = vertices[i][j];
				var v3 = vertices[i + 1][j];
				var v4 = vertices[i + 1][j + 1];

				indices.push(v1, v2, v4);
				indices.push(v2, v3, v4);
			}
		}

		bufferGeometry.setIndex(new (positions.count > 65535
			? THREE.Uint32Attribute
			: THREE.Uint16Attribute)(indices, 1));
		bufferGeometry.addAttribute('position', positions);

		var geometry = new THREE.Geometry();
		geometry.type = 'QuaterSphereGeometry';
		geometry.fromBufferGeometry(bufferGeometry);

		return geometry;
	}

	function CubicBezPoint(p0, p1, p2, p3, d) {

		var o = {
			x : 0,
			y : 0
		};

		var v = (1 - d) * (1 - d) * (1 - d);
		o.x += v * p0.x;
		o.y += v * p0.y;

		v = 3 * d * (1 - d) * (1 - d);
		o.x += v * p1.x;
		o.y += v * p1.y;

		v = 3 * d * d * (1 - d);
		o.x += v * p2.x;
		o.y += v * p2.y;

		v = d * d * d;
		o.x += v * p3.x;
		o.y += v * p3.y;

		return o;
	}

	function QuadraticBezPoint(p0, p1, p2, d) {

		var o = {
			x : 0,
			y : 0
		};

		var v = (1 - d) * (1 - d);
		o.x += v * p0.x;
		o.y += v * p0.y;

		v = 2 * d * (1 - d);
		o.x += v * p1.x;
		o.y += v * p1.y;

		v = d * d;
		o.x += v * p2.x;
		o.y += v * p2.y;

		return o;
	}

	var stereoEnabled = false;

	var self = {
		set_view_quaternion : function(value) {
			m_view_quat_1 = m_view_quat;
			m_view_quat_1_time = m_view_quat_time;
			m_view_quat = value;
			m_view_quat_time = new Date().getTime();

			var diff_time = (m_view_quat_time - m_view_quat_1_time) / 1000;
			var diff_quat = m_view_quat_1.clone().conjugate()
				.multiply(m_view_quat);
			var cos = diff_quat.w;
			var sin = Math.sqrt(diff_quat.x * diff_quat.x + diff_quat.y
				* diff_quat.y + diff_quat.z * diff_quat.z);
			m_view_av_rad = (Math.atan2(sin, cos) * 2) / diff_time;
			// console.log("cos:" + cos + ",sin:" + sin + ",av:"
			// + (180 * m_view_av_rad / Math.PI));
			if (sin == 0) {
				m_view_av_n = new THREE.Vector3(0, 0, 1);
			} else {
				m_view_av_n = new THREE.Vector3(diff_quat.x / sin, diff_quat.y
					/ sin, diff_quat.z / sin);
			}
		},
		predict_view_quaternion : function() {
			var rad = m_view_av_rad * m_texture_latency;
			var cos = Math.cos(rad / 2);
			var sin = Math.sin(rad / 2);
			var diff_quat = new THREE.Quaternion(sin * m_view_av_n.x, sin
				* m_view_av_n.y, sin * m_view_av_n.z, cos);
			return m_view_quat.clone().multiply(diff_quat);
		},
		get_adaptive_texture_fov : function() {
			var diff_quat = m_view_tex_diff_quat;
			var cos = diff_quat.w;
			var sin = Math.sqrt(diff_quat.x * diff_quat.x + diff_quat.y
				* diff_quat.y + diff_quat.z * diff_quat.z);
			var diff_theta = Math.atan2(sin, cos) * 2;
			while (Math.abs(diff_theta) > Math.PI) {
				if (diff_theta > 0) {
					diff_theta -= 2 * Math.PI;
				} else {
					diff_theta += 2 * Math.PI;
				}
			}
			var fov = m_view_fov + 180 * Math.abs(diff_theta) / Math.PI;
			fov = Math.round(fov / 5) * 5;
			if (fov > m_limit_fov) {
				fov = m_limit_fov;
			}
			return fov;
		},

		fps : 0,
		checkImageDelay : 1000,
		vertex_type : "",
		vertex_type_forcibly : "",
		fragment_type : "",

		get_info : function() {
			var rtt = m_texture_latency - m_texture_processed
				- m_texture_encoded - m_texture_decoded;
			var info = {
				latency : m_texture_latency,
				fps : m_texture_fps,
				idle_time : m_texture_idle_time,
				processed : m_texture_processed,
				encoded : m_texture_encoded,
				decoded : m_texture_decoded,
				rtt : rtt,
			};
			return info;
		},

		loadTexture : function(image_url, image_type) {

			if (!image_type) {
				image_type = splitExt(image_url.split('?')[0])[1].toLowerCase();
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
								m_videoImage = document.createElement('canvas');
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

		get_frame_num : function() {
			return m_texture_num;
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
					var value = (now - parseFloat(map["client_key"][2])) / 1000
						- idle_time;
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
					m_texture_encoded = m_texture_encoded * 0.9 + value * 0.1;

				}
				{// decoded
					var decoded = (now - time) / 1000;
					m_texture_decoded = m_texture_decoded * 0.9 + decoded * 0.1;
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
			} else if (type == "yuv") {
				self.setModel(vertex_type, "yuv");

				var raw_data = new Uint8Array(data);
				var ylen = width * height;
				var uvlen = (width / 2) * (height / 2);

				var yData = raw_data.subarray(0, ylen);
				var uData = raw_data.subarray(ylen, ylen + uvlen);
				var vData = raw_data.subarray(ylen + uvlen, ylen + uvlen
					+ uvlen);

				var yDataPerRow = width;
				var yRowCnt = height;

				var uDataPerRow = width / 2;
				var uRowCnt = height / 2;

				var vDataPerRow = uDataPerRow;
				var vRowCnt = uRowCnt;

				var gl = m_renderer.context;
				m_renderer.setTexture(m_texture_y, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yDataPerRow, yRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, yData);

				m_renderer.setTexture(m_texture_u, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, uDataPerRow, uRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uData);

				m_renderer.setTexture(m_texture_v, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, vDataPerRow, vRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, vData);

				m_texture_width = width;
				m_texture_height = height;
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

		init : function(canvas, callback) {

			m_canvas = canvas;

			m_camera = new THREE.PerspectiveCamera(150, window.innerWidth
				/ window.innerHeight, 1, 1100);
			m_camera.position = new THREE.Vector3(0, 0, 0);
			m_camera.target = new THREE.Vector3(0, 0, -1);
			m_camera.up = new THREE.Vector3(0, 1, 0);
			m_camera.lookAt(m_camera.target);

			m_scene = new THREE.Scene();

			m_renderer = new THREE.WebGLRenderer({
				canvas : m_canvas,
				antialias : true
			});
			m_renderer.setPixelRatio(window.devicePixelRatio);
			m_renderer.setSize(window.innerWidth, window.innerHeight);
			container.appendChild(m_renderer.domElement);

			onWindowResize();
			window.addEventListener('resize', onWindowResize, false);

			// texture
			m_texture = new THREE.Texture(new Image());
			m_texture.needsUpdate = true;
			m_texture.generateMipmaps = false;// performance
			m_texture.minFilter = THREE.LinearFilter;// performance
			m_texture.anisotropy = m_renderer.getMaxAnisotropy();

			m_texture_y = new THREE.Texture(new Image());
			m_texture_y.needsUpdate = true;
			m_texture_y.generateMipmaps = false;// performance
			m_texture_y.minFilter = THREE.LinearFilter;// performance
			m_texture_y.anisotropy = m_renderer.getMaxAnisotropy();

			m_texture_u = new THREE.Texture(new Image());
			m_texture_u.needsUpdate = true;
			m_texture_u.generateMipmaps = false;// performance
			m_texture_u.minFilter = THREE.LinearFilter;// performance
			m_texture_u.anisotropy = m_renderer.getMaxAnisotropy();

			m_texture_v = new THREE.Texture(new Image());
			m_texture_v.needsUpdate = true;
			m_texture_v.generateMipmaps = false;// performance
			m_texture_v.minFilter = THREE.LinearFilter;// performance
			m_texture_v.anisotropy = m_renderer.getMaxAnisotropy();

			var get_y_return_str_func = function(cur) {
				var str = "";
				if (cur == 31) {
					str += "return 1.0;\n";
				} else {
					str += "float k = (y_table[" + (cur + 1) + "] - y_table["
						+ cur + "]) / (x_table[" + (cur + 1) + "] - x_table["
						+ cur + "]);\n";
					str += "return k * (x - x_table[" + cur + "]) + y_table["
						+ cur + "];\n";

				}
				return str;
			}
			var get_y_str_func = function(cur, s) {
				var str = "";
				if (s == 0) {
					str += "if(x <= x_table[" + cur + "]) {\n";
					str += get_y_return_str_func(cur - 1);
					str += "}else{\n";
					str += get_y_return_str_func(cur);
					str += "}\n";
				} else {
					str += "if(x <= x_table[" + cur + "]) {\n";
					str += get_y_str_func(parseInt(cur - s), parseInt(s / 2));
					str += "}else{\n";
					str += get_y_str_func(parseInt(cur + s), parseInt(s / 2));
					str += "}\n";
				}
				return str;
			};
			var get_y_str = get_y_str_func(32 / 2, 32 / 4);

			// load shader
			var loaded_shader_num = 0;
			var shader_list = [{
				url : "shader/window.vert?cache=no",
				shader : "window_vertex_shader"
			}, {
				url : "shader/window_yuv.frag?cache=no",
				shader : "window_yuv_fragment_shader"
			}, {
				url : "shader/window_rgb.frag?cache=no",
				shader : "window_rgb_fragment_shader"
			}, {
				url : "shader/picam360map.vert?cache=no",
				shader : "picam360map_vertex_shader"
			}, {
				url : "shader/picam360map_yuv.frag?cache=no",
				shader : "picam360map_yuv_fragment_shader"
			}, {
				url : "shader/picam360map_rgb.frag?cache=no",
				shader : "picam360map_rgb_fragment_shader"
			}, {
				url : "shader/picam360map.vert?cache=no",
				shader : "picam360map3d_vertex_shader"
			}, {
				url : "shader/picam360map3d_yuv.frag?cache=no",
				shader : "picam360map3d_yuv_fragment_shader"
			}, {
				url : "shader/picam360map3d_rgb.frag?cache=no",
				shader : "picam360map3d_rgb_fragment_shader"
			}, {
				url : "shader/equirectangular.vert?cache=no",
				shader : "equirectangular_vertex_shader"
			}, {
				url : "shader/equirectangular_yuv.frag?cache=no",
				shader : "equirectangular_yuv_fragment_shader"
			}, {
				url : "shader/equirectangular_rgb.frag?cache=no",
				shader : "equirectangular_rgb_fragment_shader"
			}, ];
			shader_list.forEach(function(item) {
				loadFile(item.url, function(shader) {
					m_shaders[item.shader] = shader
						.replace("%GET_Y%", get_y_str);
					loaded_shader_num++;
					if (callback && loaded_shader_num == shader_list.length) {
						callback();
					}
				});
			});
		},

		getTextureImg : function() {
			return m_videoImage;
		},

		setTexureFov : function(value) {
			m_texture_fov = value;
		},

		setViewFov : function(value) {
			m_view_fov = value;
		},

		setTextureImg : function(texture) {
			m_texture_width = texture.width;
			m_texture_height = texture.height;

			m_texture.image = texture;
			m_texture.needsUpdate = true;
		},

		setModel : function(vertex_type, fragment_type) {
			if (self.vertex_type == vertex_type
				&& self.fragment_type == fragment_type) {
				return;
			} else {
				self.vertex_type = vertex_type;
				self.fragment_type = fragment_type;
			}

			m_camera.target = new THREE.Vector3(0, 0, 1);
			m_camera.up = new THREE.Vector3(0, 1, 0);
			m_camera.lookAt(m_camera.target);

			for (var i = m_scene.children.length - 1; i >= 0; i--) {
				m_scene.remove(m_scene.children[i]);
			}

			var num_of_materials = (self.vertex_type == "picam360map" || self.vertex_type == "picam360map3d")
				? 4
				: 1;
			for (var k = 0; k < num_of_materials; k++) {
				var geometry;
				if (self.vertex_type == "picam360map"
					|| self.vertex_type == "picam360map3d") {
					geometry = quaterSphereGeometry(64, k * Math.PI / 2);
				} else if (self.vertex_type == "equirectangular") {
					geometry = windowGeometry(m_maxfov, m_maxfov, 64);
				} else if (self.vertex_type == "window") {
					// position is x:[-1,1],y:[-1,1]
					geometry = new THREE.PlaneGeometry(2, 2);
				} else {
					continue;
				}
				var material = new THREE.ShaderMaterial({
					vertexShader : m_shaders[vertex_type + "_vertex_shader"],
					fragmentShader : m_shaders[vertex_type + "_"
						+ fragment_type + "_fragment_shader"],
					uniforms : {
						eye_index : {
							type : 'f',
							value : 0
						},
						material_index : {
							type : 'f',
							value : k
						},
						frame_scalex : {
							type : 'f',
							value : 1
						},
						frame_scaley : {
							type : 'f',
							value : 1
						},
						tex_scalex : {
							type : 'f',
							value : 1
						},
						tex_scaley : {
							type : 'f',
							value : 1
						},
						r_table : {
							type : 'fv1',
							value : []
						},
						pitch_table : {
							type : 'fv1',
							value : []
						},
						tex : {
							type : 't',
							value : m_texture
						},
						tex_y : {
							type : 't',
							value : m_texture_y
						},
						tex_u : {
							type : 't',
							value : m_texture_u
						},
						tex_v : {
							type : 't',
							value : m_texture_v
						},
						YUV2RGB : {
							type : 'm4',
							value : YUV2RGB
						},
						unif_matrix : {
							type : 'm4',
							value : new THREE.Matrix4()
						},
					},
					side : THREE.DoubleSide,
					blending : THREE.NormalBlending,
					transparent : true,
					depthTest : false
				});

				var mesh = new THREE.Mesh(geometry, material);
				mesh.material.needsUpdate = true;
				m_scene.add(mesh);
			}
		},

		checkImageLastUpdate : true,

		setShaderParam : function(name, value) {
			for (var i = 0; i < m_scene.children.length; i++) {
				m_scene.children[i].material.uniforms[name].value = value;
			}
		},

		animate : function(elapsedTime) {
			m_view_tex_diff_quat = m_tex_quat.clone().conjugate()
				.multiply(m_view_quat);
			{
				var euler_correct = new THREE.Euler(THREE.Math.degToRad(-90), THREE.Math
					.degToRad(180), THREE.Math.degToRad(0), "YXZ");
				var quat_correct = new THREE.Quaternion();
				quat_correct.setFromEuler(euler_correct);

				if (self.vertex_type == "picam360map"
					|| self.vertex_type == "picam360map3d") {

					{// pitch to r look-up table
						if (!m_table_cache[m_texture_fov]) {
							var stepnum = 32;
							var fov_min = 30;
							var fov_max = 120;
							var fov_factor = 1.0
								- (Math
									.min(Math.max(m_texture_fov / 2.0, fov_min), fov_max) - fov_min)
								/ (fov_max - fov_min) / 2.0;
							var x_ary = [];
							var y_ary = [];
							var p0 = {
								x : 0.0,
								y : 0.0
							};
							var p1 = {
								x : fov_factor * Math.sqrt(2.0),
								y : (1.0 - fov_factor) * Math.PI
							};
							var p2 = {
								x : Math.sqrt(2.0),
								y : Math.PI
							};
							for (var i = 0; i < stepnum; i++) {
								var p = QuadraticBezPoint(p0, p1, p2, i
									/ (stepnum - 1));
								x_ary[i] = p.x;
								y_ary[i] = p.y;
							}
							if (false) { // for debug
								var resol_ary = [];
								for (var i = 0; i < stepnum - 1; i++) {
									resol_ary[i] = m_texture_width
										* (y_ary[i + 1] - y_ary[i]) * stepnum;
									console.log("" + (x_ary[i] * 180) + ","
										+ y_ary[i] + "," + resol_ary[i]);
								}
							}
							m_table_cache[m_texture_fov] = [x_ary, y_ary];
						}
						self
							.setShaderParam("r_table", m_table_cache[m_texture_fov][0]);
						self
							.setShaderParam("pitch_table", m_table_cache[m_texture_fov][1]);
					}
					{// focal point shift
						var diff_quat = m_view_tex_diff_quat;
						diff_quat = quat_correct.clone().multiply(diff_quat)
							.multiply(quat_correct.clone().conjugate());
						self.setShaderParam("unif_matrix", new THREE.Matrix4()
							.makeRotationFromQuaternion(diff_quat.conjugate()));
					}
				} else if (self.vertex_type == "equirectangular") {
					var view_quat = m_view_quat.clone().multiply(quat_correct);
					self.setShaderParam("unif_matrix", new THREE.Matrix4()
						.makeRotationFromQuaternion(view_quat));
				}

				{
					var window_aspect = (stereoEnabled
						? window.innerWidth / 2
						: window.innerWidth)
						/ window.innerHeight;
					var fov_rad = m_view_fov * Math.PI / 180.0;
					var fov_gain = Math.tan(fov_rad / 2);
					var scale = 1.0 / fov_gain;
					if (window_aspect < 1.0) {
						self.setShaderParam("frame_scalex", scale
							/ window_aspect);
						self.setShaderParam("frame_scaley", scale);
					} else {
						self.setShaderParam("frame_scalex", scale);
						self.setShaderParam("frame_scaley", scale
							* window_aspect);
					}
				}
			}
			if (stereoEnabled) {
				var size = m_renderer.getSize();
				m_renderer.enableScissorTest(true);

				self.setShaderParam("eye_index", 0);
				m_renderer.setScissor(0, 0, size.width / 2, size.height);
				m_renderer.setViewport(0, 0, size.width / 2, size.height);
				m_renderer.render(m_scene, m_camera);

				self.setShaderParam("eye_index", 1);
				m_renderer
					.setScissor(size.width / 2, 0, size.width / 2, size.height);
				m_renderer
					.setViewport(size.width / 2, 0, size.width / 2, size.height);
				m_renderer.render(m_scene, m_camera);

				m_renderer.enableScissorTest(false);
			} else {
				self.setShaderParam("eye_index", 0);
				m_renderer.render(m_scene, m_camera);
			}
		},

		pushAudioStream : function(left, right) {
			if (!m_audio_play) {
				return;
			}
			var cutoff;
			var count = 0;
			for (cutoff = m_audio_buffer.length - 1; cutoff > 0; cutoff--) {
				count += m_audio_buffer[cutoff][0].length;
				if (count > m_sample_rate) { // 1sec
					break;
				}
			}
			if (cutoff > 0) {
				m_audio_buffer = m_audio_buffer.slice(cutoff);
			}
			m_audio_buffer.push([left, right]);
		},
		setAudioEnabled : function(bln) {
			if (bln == m_audio_play) {
				return;
			}
			m_audio_play = bln;
			if (m_audio_play) {
				m_audio_source = m_audio_contxt.createBufferSource();
				m_audio_source.connect(m_audio_script_proc);
				m_audio_script_proc.connect(m_audio_contxt.destination);
				m_audio_source.start();
			} else {
				m_audio_source.stop();
				m_audio_source.disconnect(m_audio_script_proc);
				m_audio_script_proc.disconnect(m_audio_contxt.destination);
			}
		},

		setStereoEnabled : function(value) {
			stereoEnabled = value;
			onWindowResize();
		}
	};
	return self;
}