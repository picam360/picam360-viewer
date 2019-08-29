/**
 * @author takumadx / http://www.ohmydigifab.com/
 */

OMVR = (function() {

	var m_base_path = (function() {
		try{
			var path = document.currentScript.src.split('?')[0];
			var mydir = path.split('/').slice(0, -1).join('/') + '/';
			return mydir;
		}
		catch{
			return '';

		}
	})();

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

	function quaterSphereGeometry(fov, num_of_steps) {
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.type = 'QuaterSphereBufferGeometry';

		var vertexCount = ((num_of_steps + 1) * (num_of_steps / 4 + 1) * 4);

		var positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);

		var r2pitch_table = get_r2pitch_table(fov);
		var pi_idx = parseInt(1.0 / Math.sqrt(2) * num_of_steps);
		var indices = [];
		var vertices = [];
		var index = 0;
		for (var k = 0; k < 4; k++) {
			var offset = k * Math.PI / 2;
			var offset_idx = vertices.length;
			for (var i = 0; i <= num_of_steps; i++) {
				var theta;
				var r;
				if (i <= pi_idx) {
					r = i / pi_idx;
				} else {
					r = (Math.sqrt(2) - 1.0) * (i - pi_idx)
						/ (num_of_steps - pi_idx) + 1.0;
				}
				theta = get_y(r, r2pitch_table[0], r2pitch_table[1], 32);
				// console.log(r + ":" + theta);
				var verticesRow = [];
				for (var j = 0; j <= num_of_steps / 4; j++) {
					var phi = j * (Math.PI / 2) / (num_of_steps / 4) + offset;
					var x = Math.sin(theta) * Math.cos(phi) * (k + 1);
					var y = Math.sin(theta) * Math.sin(phi) * (k + 1);
					var z = Math.cos(theta) * (k + 1);

					positions.setXYZ(index, x, y, z);

					verticesRow.push(index);

					index++;
				}
				vertices.push(verticesRow);
			}

			for (var i = 0; i < num_of_steps; i++) {
				for (var j = 0; j < num_of_steps / 4; j++) {
					var v1 = vertices[i + offset_idx][j + 1];
					var v2 = vertices[i + offset_idx][j];
					var v3 = vertices[i + 1 + offset_idx][j];
					var v4 = vertices[i + 1 + offset_idx][j + 1];

					indices.push(v1, v2, v4);
					indices.push(v2, v3, v4);
				}
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
	function get_r2pitch_table(fov) {
		var stepnum = 32;
		var fov_min = 30;
		var fov_max = 120;
		var fov_factor = 1.0
			- (Math.min(Math.max(fov / 2.0, fov_min), fov_max) - fov_min)
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
			var p = QuadraticBezPoint(p0, p1, p2, i / (stepnum - 1));
			x_ary[i] = p.x;
			y_ary[i] = p.y;
		}
		if (false) { // for debug
			var resol_ary = [];
			for (var i = 0; i < stepnum - 1; i++) {
				resol_ary[i] = m_texture_width * (y_ary[i + 1] - y_ary[i])
					* stepnum;
				console.log("" + (x_ary[i] * 180) + "," + y_ary[i] + ","
					+ resol_ary[i]);
			}
		}
		return [x_ary, y_ary];
	}

	function get_y(x, x_table, y_table, table_size) {
		var cur = table_size / 2;
		for (var s = table_size / 4; s > 0; s /= 2) {
			cur += (x <= x_table[cur]) ? -s : s;
		}
		if (x <= x_table[cur]) {
			cur--;
		}
		var cur_p1 = cur + 1;
		var k = (y_table[cur_p1] - y_table[cur])
			/ (x_table[cur_p1] - x_table[cur]);
		return k * (x - x_table[cur]) + y_table[cur];
	}

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback(req.responseText);
		}
	}

	function OMVR() {

		// picam360map vars
		var m_view_fov_cache = 0;
		var m_table_cache = [];

		// webgl
		var m_camera, m_scene, m_renderer;
		var m_canvas;
		var m_context;
		var m_texture;
		var m_texture_y;
		var m_texture_u;
		var m_texture_v;

		// geometry params
		var m_maxfov = 150;

		// texture info
		var m_texture_fov = 90;
		var m_texture_width = 512;
		var m_texture_height = 512;
		var m_tex_quat = new THREE.Quaternion();

		// view quat
		var m_view_quat = new THREE.Quaternion();
		var m_view_tex_diff_quat = new THREE.Quaternion();

		// shader
		var m_shaders = {};

		// rendering params
		var m_view_fov = 90;
		var stereoEnabled = false;

		var self = {
			vertex_type : "",
			vertex_type_forcibly : "",
			fragment_type : "",

			setCanvasSize : function(width, height) {
				m_camera.aspect = width / height;
				m_camera.updateProjectionMatrix();

				m_renderer.setSize(width, height);

				m_view_fov_cache = 0;// cache clear
			},

			init : function(canvas, devicePixelRatio, callback) {
				m_canvas = canvas;

				m_camera = new THREE.PerspectiveCamera(150, m_canvas.width
					/ m_canvas.height, 1, 1100);
				m_camera.position = new THREE.Vector3(0, 0, 0);
				m_camera.target = new THREE.Vector3(0, 0, -1);
				m_camera.up = new THREE.Vector3(0, 1, 0);
				m_camera.lookAt(m_camera.target);

				m_scene = new THREE.Scene();

				m_renderer = new THREE.WebGLRenderer({
					canvas : m_canvas,
					antialias : true
				});
				m_renderer.setPixelRatio(devicePixelRatio);
				m_renderer.setSize(m_canvas.width, m_canvas.height);
				// container.appendChild(m_renderer.domElement);

				// texture
				// var filter = THREE.NearestFilter;
				var filter = THREE.LinearFilter;
				m_texture = new THREE.DataTexture();
				m_texture.needsUpdate = true;
				m_texture.generateMipmaps = false;// performance
				m_texture.minFilter = filter;// performance
				m_texture.anisotropy = m_renderer.getMaxAnisotropy();

				m_texture_y = new THREE.DataTexture();
				m_texture_y.needsUpdate = true;
				m_texture_y.generateMipmaps = false;// performance
				m_texture_y.minFilter = filter;// performance
				m_texture_y.anisotropy = m_renderer.getMaxAnisotropy();

				m_texture_u = new THREE.DataTexture();
				m_texture_u.needsUpdate = true;
				m_texture_u.generateMipmaps = false;// performance
				m_texture_u.minFilter = filter;// performance
				m_texture_u.anisotropy = m_renderer.getMaxAnisotropy();

				m_texture_v = new THREE.DataTexture();
				m_texture_v.needsUpdate = true;
				m_texture_v.generateMipmaps = false;// performance
				m_texture_v.minFilter = filter;// performance
				m_texture_v.anisotropy = m_renderer.getMaxAnisotropy();

				var get_y_return_str_func = function(cur) {
					var str = "";
					if (cur == 31) {
						str += "return 1.0;\n";
					} else {
						str += "float k = (y_table[" + (cur + 1)
							+ "] - y_table[" + cur + "]) / (x_table["
							+ (cur + 1) + "] - x_table[" + cur + "]);\n";
						str += "return k * (x - x_table[" + cur
							+ "]) + y_table[" + cur + "];\n";

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
				shader_list
					.forEach(function(item) {
						loadFile(m_base_path + item.url, function(shader) {
							m_shaders[item.shader] = shader
								.replace("%GET_Y%", get_y_str);
							loaded_shader_num++;
							if (callback
								&& loaded_shader_num == shader_list.length) {
								callback();
							}
						});
					});
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

			setTextureRawYuv : function(vertex_type, data, width, height, quat, fov) {
				self.setModel(vertex_type, "yuv");
				m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_texture_fov = fov;

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
			},
			
			setTextureImageBitmap : function(vertex_type, img, quat, fov) {
				  const {width,height} = img;
				self.setModel(vertex_type, "rgb");
				m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_texture_fov = fov;

				var gl = m_renderer.context;
				m_renderer.setTexture(m_texture, 0);
				gl
					.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
				//.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, img);

				m_texture_width = width;
				m_texture_height = height;
			},
			
			video : null,
			setVideoTexture : function(vertex_type, video, quat, fov) {
				m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_texture_fov = fov;

				if(!self.video){
					self.video = video;
					m_texture = new THREE.VideoTexture(self.video);
					m_texture.needsUpdate = true;
//					var gl = m_renderer.context;
//					m_renderer.setTexture(m_texture, 0);
//					gl
//						.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
//					//.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, img);
				}
				self.setModel(vertex_type, "rgb");

				m_texture_width = video.videoWidth;
				m_texture_height = video.videoHeight;
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

				{
					var geometry;
					switch (self.vertex_type) {
						case "picam360map" :
						case "picam360map3d" :
							geometry = quaterSphereGeometry(120, 64);
							break;
						case "equirectangular" :
							geometry = windowGeometry(m_maxfov, m_maxfov, 64);
							break;
						case "window" :
						default :
							// position is x:[-1,1],y:[-1,1]
							geometry = new THREE.PlaneGeometry(2, 2);
							self.vertex_type = "window";
							break;
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
							pixel_size_x : {
								type : 'f',
								value : 0.001
							},
							pixel_size_y : {
								type : 'f',
								value : 0.001
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

			setShaderParam : function(name, value) {
				for (var i = 0; i < m_scene.children.length; i++) {
					m_scene.children[i].material.uniforms[name].value = value;
				}
			},

			animate : function(fov, quat) {
				m_view_fov = fov;
				m_view_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_view_tex_diff_quat = m_tex_quat.clone().conjugate()
					.multiply(m_view_quat);
				{
					var euler_correct = new THREE.Euler(THREE.Math
						.degToRad(-90), THREE.Math.degToRad(180), THREE.Math
						.degToRad(0), "YXZ");
					var quat_correct = new THREE.Quaternion();
					quat_correct.setFromEuler(euler_correct);

					if (self.vertex_type == "picam360map"
						|| self.vertex_type == "picam360map3d") {

						{// pitch to r look-up table
							if (!m_table_cache[m_texture_fov]) {
								m_table_cache[m_texture_fov] = get_r2pitch_table(m_texture_fov);
							}
							self
								.setShaderParam("r_table", m_table_cache[m_texture_fov][0]);
							self
								.setShaderParam("pitch_table", m_table_cache[m_texture_fov][1]);
						}
						{// focal point shift
							var diff_quat = m_view_tex_diff_quat;
							diff_quat = quat_correct.clone()
								.multiply(diff_quat).multiply(quat_correct
									.clone().conjugate());
							self
								.setShaderParam("unif_matrix", new THREE.Matrix4()
									.makeRotationFromQuaternion(diff_quat
										.conjugate()));
						}
					} else if (self.vertex_type == "equirectangular") {
						var view_quat = m_view_quat.clone()
							.multiply(quat_correct);
						self.setShaderParam("unif_matrix", new THREE.Matrix4()
							.makeRotationFromQuaternion(view_quat));
					}

					if (m_view_fov_cache != m_view_fov) {
						m_view_fov_cache = m_view_fov;
						var window_aspect = (stereoEnabled
							? m_canvas.width / 2
							: m_canvas.width)
							/ m_canvas.height;
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
						self
							.setShaderParam("pixel_size_x", 1.0 / m_texture_width);
						self
							.setShaderParam("pixel_size_y", 1.0 / m_texture_height);
					}
				}
				if (stereoEnabled) {
					var size = m_renderer.getSize();
					
					m_renderer.autoClear = false;
					m_renderer.clear();
					
					//m_renderer.enableScissorTest(true); //to be removed

					self.setShaderParam("eye_index", 0);
					//m_renderer.setScissor(0, 0, size.width / 2, size.height); //to be removed
					m_renderer.setViewport(0, 0, size.width / 2, size.height);
					m_renderer.render(m_scene, m_camera);

					self.setShaderParam("eye_index", 1);
					//m_renderer.setScissor(size.width / 2, 0, size.width / 2, size.height); //to be removed
					m_renderer.setViewport(size.width / 2, 0, size.width / 2, size.height);
					m_renderer.render(m_scene, m_camera);

					//m_renderer.enableScissorTest(false); //to be removed
				} else {
					self.setShaderParam("eye_index", 0);
					m_renderer.render(m_scene, m_camera);
				}
			},

			setStereoEnabled : function(value) {
				stereoEnabled = value;
				m_view_fov_cache = 0; //cache clear
			}
		};
		return self;
	}
	return OMVR;
})();