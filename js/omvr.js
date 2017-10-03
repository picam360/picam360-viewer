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
	var m_view_fov = 90;
	var m_texture_fov = 90;
	var m_texture_ttl = 0;
	var m_texture_fps = 0;
	var m_texture_num = 0;
	var m_texture_elapsed = 0;
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
	var m_angular_pitch_2_r_cache = [];

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
			var rad = m_view_av_rad * m_texture_ttl;
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
		fragment_type : "",

		get_texture_ttl : function() {
			return m_texture_ttl;
		},

		get_texture_fps : function() {
			return m_texture_fps;
		},

		get_texture_elapsed : function() {
			return m_texture_elapsed;
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

		handle_frame : function(type, data, width, height, info) {
			m_texture_num++;

			var now = new Date().getTime();
			var tex_quat;
			var vertex_type = self.vertex_type;
			if (info) {
				var split = info.split(' ');
				for (var i = 0; i < split.length; i++) {
					var separator = (/[=,\"]/);
					var _split = split[i].split(separator);
					if (_split[0] == "view_quat") { // view quaternion
						var x = parseFloat(_split[2]);
						var y = parseFloat(_split[3]);
						var z = parseFloat(_split[4]);
						var w = parseFloat(_split[5]);
						tex_quat = new THREE.Quaternion(x, y, z, w);
					} else if (_split[0] == "fov") {
						m_texture_fov = parseFloat(_split[2]);
					} else if (_split[0] == "ttl_key") { // ttl_key
						var value = (now - parseFloat(_split[2])) / 1000;
						if (!isNaN(value)) {
							m_texture_ttl = m_texture_ttl * 0.9 + value * 0.1;
						}
					} else if (_split[0] == "elapsed") {
						var value = parseFloat(_split[2]);
						m_texture_elapsed = m_texture_elapsed * 0.9 + value
							* 0.1;
					} else if (_split[0] == "mode") {
						switch (_split[2]) {
							case "WINDOW" :
							case "EQUIRECTANGULAR" :
							case "ANGULAR" :
								vertex_type = _split[2].toLowerCase();
								break;
						}
						// vertex_type = "window";//for debug
					}
				}
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
			} else if (vertex_type == "angular") {
				m_limit_fov = 180;
			}
			if (type == "raw_bmp") {
				self.setModel(vertex_type, "bmp");

				var img = m_texture.image;
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
				self.setModel(vertex_type, "bmp");

				var img = m_texture.image;
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

			// load shader
			var loaded_shader_num = 0;
			var shader_list = [{
				url : "shader/window.vert?cache=no",
				shader : "window_vertex_shader"
			}, {
				url : "shader/texture_yuv.frag?cache=no",
				shader : "window_yuv_fragment_shader"
			}, {
				url : "shader/texture_rgb.frag?cache=no",
				shader : "window_rgb_fragment_shader"
			}, {
				url : "shader/angular.vert?cache=no",
				shader : "angular_vertex_shader"
			}, {
				url : "shader/texture_yuv.frag?cache=no",
				shader : "angular_yuv_fragment_shader"
			}, {
				url : "shader/texture_rgb.frag?cache=no",
				shader : "angular_rgb_fragment_shader"
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
					angular_pitch_2_r : {
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

				if (self.vertex_type == "angular") {
					{// pitch to r look-up table
						if (!m_angular_pitch_2_r_cache[m_texture_fov]) {
							var stepnum = 256;
							var fov_rad = m_texture_fov * Math.PI / 180.0;
							var x_ary = [0.0, 1.0, Math.sqrt(2.0)];
							var y_ary = [0.0, fov_rad, Math.PI];
							var x_ary2 = [];
							var y_ary2 = [];
							for (var i = 0; i < stepnum; i++) {
								x_ary2[i] = Math.sqrt(2.0) * i / (stepnum - 1);
								y_ary2[i] = spline(x_ary2[i], x_ary, y_ary);
							}
							// invert x y
							var stepnum3 = 64;
							var x_ary3 = [];
							var y_ary3 = [];
							x_ary3[0] = 0.0;
							y_ary3[0] = 0.0;
							for (var i = 1; i < stepnum3 - 1; i++) {
								x_ary3[i] = Math.PI * i / (stepnum3 - 1);
								for (var j = 0; j < stepnum - 1; j++) {
									if (x_ary3[i] >= y_ary2[j]
										&& x_ary3[i] < y_ary2[j + 1]) {
										var ratio = (x_ary3[i] - y_ary2[j])
											/ (y_ary2[j + 1] - y_ary2[j]);
										y_ary3[i] = ratio
											* (x_ary2[j + 1] - x_ary2[j])
											+ x_ary2[j];
										break;
									}
								}
							}
							x_ary3[stepnum3 - 1] = Math.PI;
							y_ary3[stepnum3 - 1] = Math.sqrt(2.0);
							
							m_angular_pitch_2_r_cache[m_texture_fov] = y_ary3;
						}
						m_mesh.material.uniforms.angular_pitch_2_r.value = m_angular_pitch_2_r_cache[m_texture_fov];
					}

					{// focal point shift
						var diff_quat = m_view_tex_diff_quat;

						diff_quat = quat_correct.clone().multiply(diff_quat)
							.multiply(quat_correct.clone().conjugate());
						m_mesh.material.uniforms.unif_matrix.value
							.makeRotationFromQuaternion(diff_quat);
					}
				} else if (self.vertex_type == "equirectangular") {
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