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

	var m_camera, m_scene, m_renderer, m_mesh;

	var m_window_mode = false;
	var m_canvas;
	var m_context;
	var m_effect;

	var m_limit_fov = 180;
	var m_maxfov = 150;
	var m_view_fov = 120;
	var m_fov_margin = 10;
	var m_videoTexture_fov = 120;
	var m_videoTexture_ttl = 0;
	var m_videoTexture_width = 512;
	var m_videoTexture_height = 512;
	var m_videoImage;
	var m_videoImageContext;
	var m_videoTexture;
	var m_videoTexture_y;
	var m_videoTexture_u;
	var m_videoTexture_v;
	var m_video;
	var m_videoStart = 0;

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

	function onWindowResize() {
		m_canvas.width = window.innerWidth;
		m_canvas.height = window.innerHeight;

		m_camera.aspect = window.innerWidth / window.innerHeight;
		m_camera.updateProjectionMatrix();

		m_renderer.setSize(window.innerWidth, window.innerHeight);
		m_effect.setSize(window.innerWidth, window.innerHeight);
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

	var stereoEnabled = false;

	var self = {
		set_fov_margin : function(value) {
			m_fov_margin = value;
		},
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
			var rad = m_view_av_rad * m_videoTexture_ttl;
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
			var fov = m_view_fov + m_fov_margin + 180 * Math.abs(diff_theta)
				/ Math.PI;
			if (fov > m_maxfov) {
				fov = m_maxfov;
			}
			return fov;
		},

		fps : 0,
		checkImageDelay : 1000,
		vertex_type : "",
		fragment_type : "",
		anti_delay : false,

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
								m_videoTexture = new THREE.Texture(m_videoImage);
								setTextureFunc(m_videoTexture);
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

		handle_frame_info : function(info) {
		},

		handle_frame : function(type, data, width, height, info) {
			var tex_quat;
			if (info) {
				var split = info.split(' ');
				for (var i = 0; i < split.length; i++) {
					var separator = (/[=,\"]/);
					var _split = split[i].split(separator);
					if (_split[0] == "vq") { // view quaternion
						var x = parseFloat(_split[2]);
						var y = parseFloat(_split[3]);
						var z = parseFloat(_split[4]);
						var w = parseFloat(_split[5]);
						tex_quat = new THREE.Quaternion(x, y, z, w);
					} else if (_split[0] == "fov") {
						m_videoTexture_fov = parseFloat(_split[2]);
					} else if (_split[0] == "tk") { // ttl_key
						var ttl = (new Date().getTime() - parseFloat(_split[2])) / 1000;
						if (!isNaN(ttl)) {
							m_videoTexture_ttl = m_videoTexture_ttl * 0.9 + ttl
								* 0.1;
						}
					}
				}
			}
			if (tex_quat) {
				m_tex_quat = tex_quat;
			} else {
				console.log("no view quat info");
				m_tex_quat = m_view_quat.clone();
			}
			{
				var diff_quat = m_tex_quat.clone().conjugate()
					.multiply(m_view_quat);
				var cos = diff_quat.w;
				var sin = Math.sqrt(diff_quat.x * diff_quat.x + diff_quat.y
					* diff_quat.y + diff_quat.z * diff_quat.z);
				var diff_deg = 180 * (Math.atan2(sin, cos) * 2) / Math.PI;
				var view_limit_fov = (m_videoTexture_fov - m_view_fov) / 2;
				m_limit_fov = Math.max(Math.abs(diff_deg), view_limit_fov);
				// console.log("limit_fov:" + m_limit_fov);
			}
			if (type == "raw_bmp") {
				self.setModel(self.vertex_type, "bmp");

				var img = m_videoTexture.image;
				var header = get_bmp_header(width, height, 8);
				var raw_data = new Uint8Array(data);
				var blob = new Blob([header, raw_data], {
					type : "image/bmp"
				});
				var url = window.URL || window.webkitURL;
				if (img.src && img.src.indexOf("blob") == 0) {
					url.revokeObjectURL(img.src);
				}
				img.src = url.createObjectURL(blob);
				// console.log(m_target_texture.src + " : " + blob.size
				// + " : " + m_active_frame.length);
				blob = null;
			} else if (type == "yuv") {
				self.setModel(self.vertex_type, "yuv");

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
				m_renderer.setTexture(m_videoTexture_y, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, yDataPerRow, yRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, yData);

				m_renderer.setTexture(m_videoTexture_u, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, uDataPerRow, uRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uData);

				m_renderer.setTexture(m_videoTexture_v, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, vDataPerRow, vRowCnt, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, vData);

				m_videoTexture_width = width;
				m_videoTexture_height = height;
			} else if (type == "blob") {
				self.setModel(self.vertex_type, "bmp");

				var img = m_videoTexture.image;
				var url = window.URL || window.webkitURL;
				if (img.src && img.src.indexOf("blob") == 0) {
					url.revokeObjectURL(img.src);
				}
				img.src = url.createObjectURL(data);
				// console.log(img.src + " : " + blob.size);
			}
		},

		init : function(canvas, callback) {

			m_canvas = canvas;

			m_camera = new THREE.PerspectiveCamera(75, window.innerWidth
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

			m_effect = new THREE.StereoEffect(m_renderer);
			m_effect.setSize(window.innerWidth, window.innerHeight);

			onWindowResize();
			window.addEventListener('resize', onWindowResize, false);

			// texture
			m_videoTexture = new THREE.Texture(new Image());
			m_videoTexture.needsUpdate = true;
			m_videoTexture.generateMipmaps = false;// performance
			m_videoTexture.minFilter = THREE.LinearFilter;// performance
			m_videoTexture.anisotropy = m_renderer.getMaxAnisotropy();

			m_videoTexture_y = new THREE.Texture(new Image());
			m_videoTexture_y.needsUpdate = true;
			m_videoTexture_y.generateMipmaps = false;// performance
			m_videoTexture_y.minFilter = THREE.LinearFilter;// performance
			m_videoTexture_y.anisotropy = m_renderer.getMaxAnisotropy();

			m_videoTexture_u = new THREE.Texture(new Image());
			m_videoTexture_u.needsUpdate = true;
			m_videoTexture_u.generateMipmaps = false;// performance
			m_videoTexture_u.minFilter = THREE.LinearFilter;// performance
			m_videoTexture_u.anisotropy = m_renderer.getMaxAnisotropy();

			m_videoTexture_v = new THREE.Texture(new Image());
			m_videoTexture_v.needsUpdate = true;
			m_videoTexture_v.generateMipmaps = false;// performance
			m_videoTexture_v.minFilter = THREE.LinearFilter;// performance
			m_videoTexture_v.anisotropy = m_renderer.getMaxAnisotropy();

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
				url : "shader/board.vert?cache=no",
				shader : "board_vertex_shader"
			}, {
				url : "shader/board_yuv.frag?cache=no",
				shader : "board_yuv_fragment_shader"
			}, {
				url : "shader/board_rgb.frag?cache=no",
				shader : "board_rgb_fragment_shader"
			}, ];
			shader_list.forEach(function(item) {
				loadFile(item.url, function(shader) {
					m_shaders[item.shader] = shader;
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
			m_videoTexture_fov = value;
		},

		setViewFov : function(value) {
			m_view_fov = value;
		},

		setTextureImg : function(texture) {
			m_videoTexture_width = texture.width;
			m_videoTexture_height = texture.height;

			m_videoTexture.image = texture;
			m_videoTexture.needsUpdate = true;
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

			var geometry = windowGeometry(m_maxfov, m_maxfov, 64);

			// position is
			// x:[-1,1],
			// y:[-1,1]
			var material = new THREE.ShaderMaterial({
				vertexShader : m_shaders[vertex_type + "_vertex_shader"],
				fragmentShader : m_shaders[vertex_type + "_" + fragment_type
					+ "_fragment_shader"],
				uniforms : {
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
					tex : {
						type : 't',
						value : m_videoTexture
					},
					tex_y : {
						type : 't',
						value : m_videoTexture_y
					},
					tex_u : {
						type : 't',
						value : m_videoTexture_u
					},
					tex_v : {
						type : 't',
						value : m_videoTexture_v
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

			m_mesh = new THREE.Mesh(geometry, material);
			m_mesh.material.needsUpdate = true;
			for (var i = 0; i < m_scene.children.length; i++) {
				m_scene.remove(m_scene.children[i]);
			}
			m_scene.add(m_mesh);
		},

		checkImageLastUpdate : true,

		animate : function(elapsedTime) {
			m_view_tex_diff_quat = m_tex_quat.clone().conjugate()
				.multiply(m_view_quat);
			if (m_mesh && m_mesh.material.uniforms.unif_matrix) {
				var euler_correct = new THREE.Euler(THREE.Math.degToRad(-90), THREE.Math
					.degToRad(180), THREE.Math.degToRad(0), "YXZ");
				var quat_correct = new THREE.Quaternion();
				quat_correct.setFromEuler(euler_correct);

				if (self.vertex_type == "board") {
					if (self.anti_delay) {
						var diff_quat = m_view_tex_diff_quat;
						{// limit fov
							var cos = diff_quat.w;
							var sin = Math.sqrt(diff_quat.x * diff_quat.x
								+ diff_quat.y * diff_quat.y + diff_quat.z
								* diff_quat.z);
							var diff_deg = 180 * (Math.atan2(sin, cos) * 2)
								/ Math.PI;

							if (Math.abs(diff_deg) > m_limit_fov) {
								if (diff_deg < -m_limit_fov) {
									diff_deg = -m_limit_fov;
								} else if (diff_deg > m_limit_fov) {
									diff_deg = m_limit_fov;
								}
								if (sin == 0) {
									diff_quat = new THREE.Quaternion(0, 0, 0, 1);
								} else {
									var _cos = Math.cos((diff_deg / 2)
										* Math.PI / 180);
									var _sin = Math.sin((diff_deg / 2)
										* Math.PI / 180);
									diff_quat = new THREE.Quaternion(diff_quat.x
										/ sin * _sin, diff_quat.y / sin * _sin, diff_quat.z
										/ sin * _sin, _cos);
								}
							}
						}

						diff_quat = quat_correct.clone().multiply(diff_quat)
							.multiply(quat_correct.clone().conjugate());
						m_mesh.material.uniforms.unif_matrix.value
							.makeRotationFromQuaternion(diff_quat);
					}
				} else {
					var view_quat = m_view_quat.clone().multiply(quat_correct);
					m_mesh.material.uniforms.unif_matrix.value
						.makeRotationFromQuaternion(view_quat);
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
						m_mesh.material.uniforms.frame_scalex.value = scale
							/ window_aspect;
						m_mesh.material.uniforms.frame_scaley.value = scale;
					} else {
						m_mesh.material.uniforms.frame_scalex.value = scale;
						m_mesh.material.uniforms.frame_scaley.value = scale
							* window_aspect;
					}
				}

				if (self.vertex_type == "board") {
					var texture_aspect = m_videoTexture_width
						/ m_videoTexture_height;
					var fov_rad = m_view_fov * Math.PI / 180.0;
					var fov_gain = Math.tan(fov_rad / 2);
					var tex_fov_rad = m_videoTexture_fov * Math.PI / 180.0;
					var tex_fov_gain = Math.tan(tex_fov_rad / 2);
					var scale = (1.0 / fov_gain) * (fov_gain / tex_fov_gain);
					m_mesh.material.uniforms.tex_scalex.value = scale;
					m_mesh.material.uniforms.tex_scaley.value = scale
						* texture_aspect;
				}
			}
			if (stereoEnabled) {
				m_effect.render(m_scene, m_camera);
			} else {
				m_renderer.render(m_scene, m_camera);
			}
		},

		setStereoEnabled : function(value) {
			stereoEnabled = value;
			onWindowResize();
		}
	};
	return self;
}