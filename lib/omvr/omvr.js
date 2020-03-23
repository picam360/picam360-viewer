/**
 * @author takumadx / http://www.ohmydigifab.com/
 */

OMVR = (function() {
	var TEXTURE_BUFFER_NUM = 4;

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
			? THREE.Uint32BufferAttribute
			: THREE.Uint16BufferAttribute)(indices, 1));
		bufferGeometry.addAttribute('position', positions);

		var geometry = new THREE.Geometry();
		geometry.type = 'SphereWindowGeometry';
		geometry.fromBufferGeometry(bufferGeometry);

		return geometry;
	}

	function sphereGeometry(fov, num_of_steps, num_of_pixels) {
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.type = 'SphereBufferGeometry';

		var vertexCount = ((num_of_steps + 1) * (num_of_steps / 4 + 1) * 4);

		var positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);

		var M_SQRT_2 = Math.sqrt(2);
		var r2pitch_table = get_r2pitch_table(fov);
		if (num_of_pixels) { // resolution
			console.log("resolution");
			var resol_ary = [];
			for (var i = 0; i < r2pitch_table[0].length - 1; i++) {
				var dp = num_of_pixels * (r2pitch_table[0][i + 1] - r2pitch_table[0][i]);
				var dd = (r2pitch_table[1][i + 1] - r2pitch_table[1][i]) * 180 / Math.PI;
				var resolution_ppd = dp / dd;
				var resolution_pp2p = resolution_ppd * 360;
				console.log((r2pitch_table[1][i] * 180 / Math.PI) + "[deg]," +resolution_pp2p + "[pp2p]");
			}
		}
		var pi_idx = parseInt(num_of_steps / 2);
		var indices = [];
		var vertices = [];
		var index = 0;
		for (var k = 0; k < 4; k++) {
			var offset = k * Math.PI / 2;
			var offset_idx = vertices.length;
			for (var i = 0; i <= num_of_steps; i++) {
				var theta;
				// var r = (i / num_of_steps) * M_SQRT_2;
				var r;
				if (i <= pi_idx) {
					r = i / pi_idx;
				} else {
					r = (M_SQRT_2 - 1.0) * (i - pi_idx)
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
			? THREE.Uint32BufferAttribute
			: THREE.Uint16BufferAttribute)(indices, 1));
		bufferGeometry.addAttribute('position', positions);

		var geometry = new THREE.Geometry();
		geometry.type = 'QuaterSphereGeometry';
		geometry.fromBufferGeometry(bufferGeometry);

		return geometry;
	}
	function sphereGeometry_p2v(fov, width) {
		var bufferGeometry = new THREE.BufferGeometry();
		bufferGeometry.type = 'SphereBufferGeometry';

		var vertexCount = ((width/2 + 1) * (width / 2 + 1) * 4);

		var positions = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);

		var r2pitch_table = get_r2pitch_table(fov);
		var STEPNUM = 32;
		var M_SQRT_2 = Math.sqrt(2);
		var M_PI = Math.PI;
		var M_PI_DIV_2 = Math.PI/2;
		var M_PI_DIV_4 = Math.PI/4;
		var w = width;
		var h = width;
		var sqrt = Math.sqrt;
		var sin = Math.sin;
		var cos = Math.cos;
		var acos = Math.acos;
		var atan2 = Math.atan2;
		var dc_r_table = r2pitch_table[0];
		var dc_pitch_table = r2pitch_table[1];
		var indices = [];
		var vertices = [];
		var index = 0;
		for (var k = 0; k < 4; k++) {
			var offset = k * Math.PI / 2;
			var offset_idx = vertices.length;
			for (var i = 0; i <= width/2; i++) {
				// console.log(r + ":" + theta);
				var verticesRow = [];
				for (var j = 0; j <= width/2; j++) {
					var position = {x:0,y:0};
					{
						var gain_x = (k == 0) || (k == 3) ? -1 : 1;
						var gain_y = (k == 0) || (k == 1) ? -1 : 1;
						position.x = gain_x * (j / (w-1) * 2 - 1); // [-1:1]
						position.y = gain_y * (i / (h-1) * 2 - 1);// [-1:1]
						if(j == width/2) {
							position.x = 0;
						}
						if(i == width/2) {
							position.y = 0;
						}
					}
					var r = sqrt(position.x * position.x + position.y * position.y);
					if (r > M_SQRT_2) {
						r = M_SQRT_2;
					}
					var pitch_orig = get_y(r, dc_r_table, dc_pitch_table, STEPNUM);
					var roll_orig = atan2(position.y, position.x);
					if (r <= M_SQRT_2 && r > 1.0) {
						var roll_index = parseInt(roll_orig / M_PI_DIV_2);
						var roll_base = (roll_index) * M_PI_DIV_2 + (roll_orig > 0.0 ? M_PI_DIV_4 : -M_PI_DIV_4);
						var roll_diff = roll_orig - roll_base;
						var roll_gain = M_PI / (M_PI - 4.0 * acos(1.0 / r));
						roll_orig = roll_diff * roll_gain + roll_base;
					}
					position.x = sin(pitch_orig) * cos(roll_orig);
					position.y = sin(pitch_orig) * sin(roll_orig);
					position.z = cos(pitch_orig);

					positions.setXYZ(index, position.x*(k+1), position.y*(k+1), position.z*(k+1));

					verticesRow.push(index);

					index++;
				}
				vertices.push(verticesRow);
			}

			for (var i = 0; i < width / 2; i++) {
				for (var j = 0; j < width / 2; j++) {
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
			? THREE.Uint32BufferAttribute
			: THREE.Uint16BufferAttribute)(indices, 1));
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
		var m_table_cache = [];

		// webgl
		var m_renderer;
		var m_camera;
		var m_scene;
		var m_scene_overlay;
		var m_canvas;
		var m_context;
		var m_texture;
		var m_texture_y;
		var m_texture_u;
		var m_texture_v;
		var m_texture_frames_cur = 0;
		var m_texture_frames = [];
		var m_frame_buffers = [];
		var m_frame_ary = [];
		var m_frame_info_ary = [];
		var m_texture_captured_time_ms = new Date().getTime();
		var m_texture_updated_time_ms = new Date().getTime();
		var m_animate_num = 0;
		var m_texure_num = 0;
		var m_updated_image = null;
		var m_latency_msec = 0;

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
		var m_eye_offset = 0;
		var m_mesh_resolution = 64;
		var m_view_fov = 90;
		var m_vr_margin = 0; // %
		var stereoEnabled = false;
		var m_devicePixelRatio = 1;
		var m_antialias = true;
		var m_fxaa_enabled = false;

		var self = {

			setCanvasSize : function(width, height) {
				m_renderer.setSize(width, height);

				m_scene.view_fov_cache = 0;// cache clear
			},

			add_overlay_object : function(obj) {
	            m_scene_overlay.add( obj );
			},

			remove_overlay_object : function(obj) {
	            m_scene_overlay.remove( obj );
			},

			init : function(options) {
				const {callback} = options;
				m_canvas = options.canvas;
				m_devicePixelRatio = options.devicePixelRatio || 1;
				m_antialias = options.antialias;
				m_fxaa_enabled = options.fxaa_enabled;
				m_mesh_resolution = options.mesh_resolution || 64;
				m_vr_margin = options.vr_margin;
				m_eye_offset = options.eye_offset;

				m_camera = new THREE.PerspectiveCamera(150, 
						m_canvas.width / m_canvas.height, 1, 20000);

				m_scene = new THREE.Scene();
				
				{
					m_scene_overlay = new THREE.Scene();
					// Lights
					function addShadowedLight( x, y, z, color, intensity ) {
						var directionalLight = new THREE.DirectionalLight( color, intensity );
						directionalLight.position.set( x, y, z );
						m_scene_overlay.add( directionalLight );
						directionalLight.castShadow = true;
						var d = 10000;
						directionalLight.shadow.camera.left = - d;
						directionalLight.shadow.camera.right = d;
						directionalLight.shadow.camera.top = d;
						directionalLight.shadow.camera.bottom = - d;
						directionalLight.shadow.camera.near = 1;
						directionalLight.shadow.camera.far = 4;
						directionalLight.shadow.mapSize.width = 1024;
						directionalLight.shadow.mapSize.height = 1024;
						directionalLight.shadow.bias = - 0.002;
					}
					var FACTOR = 1;
					m_scene_overlay.add( new THREE.HemisphereLight( 0xffffff, 0x111111 ) );
					addShadowedLight( -0.5*FACTOR, 1*FACTOR, 1*FACTOR, 0x8888ff, 1 );
					addShadowedLight( -0.5*FACTOR, -1*FACTOR, -1*FACTOR, 0xff8888, 1 );
					addShadowedLight( 0.5*FACTOR, 1*FACTOR, -1*FACTOR, 0x88ff88, 1 );
				}

				m_renderer = new THREE.WebGLRenderer({
					canvas : m_canvas,
					antialias : m_antialias
				});
				m_renderer.setPixelRatio(m_devicePixelRatio);
				m_renderer.setSize(m_canvas.width, m_canvas.height);
				// container.appendChild(m_renderer.domElement);

				// texture
				m_texture = new THREE.DataTexture(
						new Uint8Array(16*16*4), 16, 16, THREE.RGBFormat, THREE.UnsignedByteType);
				m_texture.generateMipmaps = false;// performance

				m_texture_y = new THREE.DataTexture(
						new Uint8Array(16*16), 16, 16, THREE.LuminanceFormat, THREE.UnsignedByteType);
				m_texture_y.generateMipmaps = false;// performance

				m_texture_u = new THREE.DataTexture(
						new Uint8Array(16*16), 16, 16, THREE.LuminanceFormat, THREE.UnsignedByteType);
				m_texture_u.generateMipmaps = false;// performance

				m_texture_v = new THREE.DataTexture(
						new Uint8Array(16*16), 16, 16, THREE.LuminanceFormat, THREE.UnsignedByteType);
				m_texture_v.generateMipmaps = false;// performance
				
				for(var i=0;i<TEXTURE_BUFFER_NUM;i++){
					var texture = new THREE.DataTexture(
							new Uint8Array(16*16*4), 16, 16, THREE.RGBFormat, THREE.UnsignedByteType);
					texture.generateMipmaps = false;// performance
					
					m_texture_frames[i] = texture;
				}
				var minFilter = THREE.LinearFilter;
				var magFilter = THREE.NearestFilter;
				var anisotropy = m_renderer.capabilities.getMaxAnisotropy();
				self.setFilter({
					minFilter,
					magFilter,
					anisotropy,
				});

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
					url : "shader/fisheye.vert?cache=no",
					shader : "fisheye_vertex_shader"
				}, {
					url : "shader/fisheye_yuv.frag?cache=no",
					shader : "fisheye_yuv_fragment_shader"
				}, {
					url : "shader/fisheye_rgb.frag?cache=no",
					shader : "fisheye_rgb_fragment_shader"
				}, {
					url : "shader/picam360map.vert?cache=no",
					shader : "picam360map_vertex_shader"
				}, {
					url : "shader/picam360map_yuv.frag?cache=no",
					shader : "picam360map_yuv_fragment_shader",
				}, {
					url : "shader/picam360map_rgb.frag?cache=no",
					shader : "picam360map_rgb_fragment_shader"
				}, {
					url : "shader/picam360map.vert?cache=no",
					shader : "picam360map3d_vertex_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
				}, {
					url : "shader/picam360map_yuv.frag?cache=no",
					shader : "picam360map3d_yuv_fragment_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
				}, {
					url : "shader/picam360map_rgb.frag?cache=no",
					shader : "picam360map3d_rgb_fragment_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
				}, {
					url : "shader/picam360map_fxaa.vert?cache=no",
					shader : "picam360map_fxaa_vertex_shader"
				}, {
					url : "shader/picam360map_yuv_fxaa.frag?cache=no",
					shader : "picam360map_yuv_fxaa_fragment_shader",
				}, {
					url : "shader/picam360map_rgb_fxaa.frag?cache=no",
					shader : "picam360map_rgb_fxaa_fragment_shader"
				}, {
					url : "shader/picam360map_fxaa.vert?cache=no",
					shader : "picam360map3d_fxaa_vertex_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
				}, {
					url : "shader/picam360map_rgb_fxaa.frag?cache=no",
					shader : "picam360map3d_rgb_fxaa_fragment_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
				}, {
					url : "shader/picam360map_yuv_fxaa.frag?cache=no",
					shader : "picam360map3d_yuv_fxaa_fragment_shader",
					onload : (shader) => {return "#define STEREO_SIDE_BY_SIDE\n" + shader},
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
							if(item.onload){
								shader = item.onload(shader);
							}
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
			
			create_texture : function(tex){
				var scene = new THREE.Scene();
				var geometry = new THREE.PlaneGeometry(2, 2);
				var material = new THREE.ShaderMaterial({
					vertexShader : m_shaders["window_vertex_shader"],
					fragmentShader : m_shaders["window_rgb_fragment_shader"],
					uniforms : {
						tex : {
							type : 't',
							value : tex
						},
					},
					side : THREE.DoubleSide,
					blending : THREE.NormalBlending,
					transparent : true,
					depthTest : false
				});

				var mesh = new THREE.Mesh(geometry, material);
				mesh.material.needsUpdate = true;
				scene.add(mesh);
				
				m_renderer.autoClear = false;
				
				m_renderer.setViewport(0, 0, 1, 1);
				m_renderer.render(scene, m_camera);
				
				return m_renderer.properties.get(tex).__webglTexture;
			},
			
			get_uuid : function(fb){
				var pixels = new Uint8Array(32 * 2 * 4);

				var gl = m_renderer.getContext();
				gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
				gl.readPixels(0, 0, 32, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				
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

			setTextureRawYuv : function(vertex_type, data, width, height, quat, fov, frame_info) {
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

				m_texture_y.image.data = yData;
				m_texture_y.image.width = yDataPerRow;
				m_texture_y.image.height = yRowCnt;
				m_texture_y.needsUpdate = true;

				m_texture_u.image.data = uData;
				m_texture_u.image.width = uDataPerRow;
				m_texture_u.image.height = uRowCnt;
				m_texture_u.needsUpdate = true;

				m_texture_v.image.data = vData;
				m_texture_v.image.width = vDataPerRow;
				m_texture_v.image.height = vRowCnt;
				m_texture_v.needsUpdate = true;
				
				m_texture_width = width;
				m_texture_height = height;
				m_texture_captured_time_ms = frame_info.timestamp;
				m_texture_updated_time_ms = new Date().getTime();
			},
			
			setTextureRawRgb : function(vertex_type, img, quat, fov, frame_info) {
				const {width,height} = img;
				self.setModel(vertex_type, "rgb");
				m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_texture_fov = fov;

				var gl = m_renderer.getContext();
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, m_renderer.properties.get(m_texture).__webglTexture);
				gl
				// .texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB,
				// gl.UNSIGNED_BYTE, img);
					.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, img);

				m_texture_width = width;
				m_texture_height = height;
				m_texture_captured_time_ms = frame_info.timestamp;
				m_texture_updated_time_ms = new Date().getTime();
			},
			
			setTextureImage : function(vertex_type, img, quat, fov, frame_info) {
				m_updated_image = {
						vertex_type,
						img,
						quat,
						fov,
						frame_info,
				};
			},
			
			setFrame: function(frame) {
				// console.log("frame:"+frame.uuid);
				var ary = m_frame_info_ary;
				var uuid = frame.uuid;
				var cur = 0;
				var max_ncc = 0;
				for(var i=0;i<ary.length;i++){
					var ncc = uuid_ncc(ary[i].uuid, uuid);
					if(ncc > max_ncc){
						max_ncc = ncc;
						cur = i;
					}
				}
				if(max_ncc < 0.95){
					m_frame_ary.push(frame);
					if(m_frame_ary.length > TEXTURE_BUFFER_NUM){
						m_frame_ary = m_frame_ary.slice(m_frame_ary.length - TEXTURE_BUFFER_NUM);
					}
					// console.log("frame delay : "+max_ncc)
					return;
				}
				// console.log("frame_info found : "+max_ncc)
				var frame_info = m_frame_info_ary[cur];
				self.setModel(frame_info.vertex_type, "rgb");
				m_tex_quat = frame_info.quat;
				m_texture_fov = frame_info.fov;
				m_texture_captured_time_ms = frame_info.timestamp;
				m_texture_updated_time_ms = new Date().getTime();
				self.setShaderParam("tex", frame);
				
				m_frame_info_ary = m_frame_info_ary.slice(cur+1);
			},
			
			setFrameInfo: function(vertex_type, quat, fov, frame_info) {
				// console.log("info:"+uuid);
				var frame_info = {
					vertex_type,
					quat: new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w),
					fov,
					uuid : frame_info.uuid,
					timestamp : frame_info.timestamp,
				};
				var ary = m_frame_ary;
				var uuid = frame_info.uuid;
				var cur = 0;
				var max_ncc = 0;
				for(var i=0;i<m_frame_ary.length;i++){
					var ncc = uuid_ncc(ary[i].uuid, uuid);
					if(ncc > max_ncc){
						max_ncc = ncc;
						cur = i;
					}
				}
				if(max_ncc < 0.95){
					m_frame_info_ary.push(frame_info);
					if(m_frame_info_ary.length > TEXTURE_BUFFER_NUM){
						m_frame_info_ary = m_frame_info_ary.slice(m_frame_info_ary.length - TEXTURE_BUFFER_NUM);
					}
					// console.log("frame_info delay : "+max_ncc)
					return;
				}
				// console.log("frame found : "+max_ncc)
				var frame = m_frame_ary[cur];
				self.setModel(frame_info.vertex_type, "rgb");
				m_tex_quat = frame_info.quat;
				m_texture_fov = frame_info.fov;
				self.setShaderParam("tex", frame);
				
				m_frame_ary = m_frame_ary.slice(cur+1);
			},
			
			last_uuid : new Uint8Array(16),
			setFrameImage : function(img, uuid) {
				var gl = m_renderer.getContext();
				var tex = m_texture_frames[m_texture_frames_cur%TEXTURE_BUFFER_NUM];
				if(!m_renderer.properties.get(tex).__webglTexture){
					var _tex = self.create_texture(tex);
					if(!uuid){
						var fb = gl.createFramebuffer();
						gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
						gl.framebufferTexture2D(
						    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
						    gl.TEXTURE_2D, _tex, 0);
						gl.bindFramebuffer(gl.FRAMEBUFFER, null);
						m_frame_buffers[m_texture_frames_cur%TEXTURE_BUFFER_NUM] = fb;
					}
				}
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, m_renderer.properties.get(tex).__webglTexture);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

				m_texture_width = img.videoWidth;
				m_texture_height = img.videoHeight;

				if(!uuid){
					var fb = m_frame_buffers[m_texture_frames_cur%TEXTURE_BUFFER_NUM];
					uuid = self.get_uuid(fb);
				}
				if(uuid_abs(uuid, self.last_uuid) == 0){
					return;
				}else{
					self.last_uuid = uuid;
				}
				tex.uuid = uuid;
				self.setFrame(tex);
				m_texture_frames_cur++;
			},
			
			video : null,
			setVideoTexture : function(vertex_type, video, quat, fov, frame_info) {
				m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
				m_texture_fov = fov;

				if(!self.video){
					self.video = video;
					m_texture = new THREE.VideoTexture(self.video);
					m_texture.needsUpdate = true;
// var gl = m_renderer.context;
// m_renderer.setTexture(m_texture, 0);
// gl
// .texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
// //.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0, gl.RGB,
// gl.UNSIGNED_BYTE, img);
				}
				self.setModel(vertex_type, "rgb");

				m_texture_width = video.videoWidth;
				m_texture_height = video.videoHeight;
			},
			setFilter : function(options){
				const {
					minFilter,
					magFilter,
					anisotropy,
				} = options;
				m_texture.minFilter = minFilter;
				m_texture.anisotropy = anisotropy;
				m_texture.needsUpdate = true;
				
				m_texture_y.minFilter = minFilter;
				m_texture_y.anisotropy = anisotropy;
				m_texture_y.needsUpdate = true;
				
				m_texture_u.minFilter = minFilter;
				m_texture_u.anisotropy = anisotropy;
				m_texture_u.needsUpdate = true;

				m_texture_v.minFilter = minFilter;
				m_texture_v.anisotropy = anisotropy;
				m_texture_v.needsUpdate = true;
				
				for(var i=0;i<TEXTURE_BUFFER_NUM;i++){
					m_texture_frames[i].minFilter = minFilter;// performance
					m_texture_frames[i].anisotropy = anisotropy;
					m_texture_frames[i].needsUpdate = true;
				}
			},
			setModel : function(vertex_type, fragment_type, _view_fov, _scene) {
				var view_fov = _view_fov || m_view_fov;
				var scene = _scene || m_scene;
				if (scene.vertex_type == vertex_type
					&& scene.fragment_type == fragment_type
					&& scene.view_fov == view_fov) {
					return;
				} else {
					scene.vertex_type = vertex_type;
					scene.fragment_type = fragment_type;
					scene.view_fov = view_fov;
					scene.view_fov_cache = 0; // cache clear
				}

				for (var i = m_scene.children.length - 1; i >= 0; i--) {
					scene.remove(m_scene.children[i]);
				}

				{
					var geometry;
					switch (scene.vertex_type) {
						case "picam360map" :
						case "picam360map3d" :
							// geometry = sphereGeometry_p2v(view_fov,
							// m_texture_height);
							geometry = sphereGeometry(view_fov, m_mesh_resolution, m_texture_height);
							break;
						case "equirectangular" :
							geometry = windowGeometry(m_maxfov, m_maxfov, m_mesh_resolution);
							break;
						case "fisheye" :
							geometry = windowGeometry(m_maxfov, m_maxfov, m_mesh_resolution);
							break;
						case "window" :
						default :
							// position is x:[-1,1],y:[-1,1]
							geometry = new THREE.PlaneGeometry(2, 2);
							vertex_type = "window";
							scene.vertex_type = "window";
							break;
					}
					var vertexShader = m_shaders[vertex_type + "_vertex_shader"];
					var fragmentShader = m_shaders[vertex_type + "_" + fragment_type + "_fragment_shader"];
					if(m_fxaa_enabled && vertex_type.startsWith("picam360map")){
						vertexShader = m_shaders[vertex_type + "_fxaa_vertex_shader"];
						fragmentShader = m_shaders[vertex_type + "_" + fragment_type + "_fxaa_fragment_shader"];
					}
					var material = new THREE.ShaderMaterial({
						vertexShader,
						fragmentShader,
						uniforms : {
							vr_mode : {
								type : 'b',
								value : false
							},
							eye_index : {
								type : 'f',
								value : 0
							},
							eye_offset : {
								type : 'f',
								value : m_eye_offset
							},
							pixel_size_x : {
								type : 'f',
								value : 0.01
							},
							pixel_size_y : {
								type : 'f',
								value : 0.01
							},
							tex_aspect_ratio : {
								type : 'f',
								value : 1
							},
							view_fov : {
								type : 'f',
								value : 1
							},
							frame_scalex : {
								type : 'f',
								value : 1
							},
							frame_scaley : {
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

					
					mesh = new THREE.Mesh(geometry, material);
					mesh.material.needsUpdate = true;
					scene.add(mesh);
				}
			},

			setShaderParam : function(name, value, _scene) {
				var scene = _scene || m_scene;
				for (var i = 0; i < scene.children.length; i++) {
					scene.children[i].material.uniforms[name].value = value;
				}
			},

			animate : function(fov, quat) {
				if(m_updated_image){
					const {
						vertex_type,
						img,
						quat,
						fov,
						frame_info,
					} = m_updated_image;
					const {width,height} = img;
					self.setModel(vertex_type, "rgb");
					m_tex_quat = new THREE.Quaternion(quat._x, quat._y, quat._z, quat._w);
					m_texture_fov = fov;

					
					var gl = m_renderer.getContext();
					// gl.flush();
					// var st = new Date().getTime();
					
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, m_renderer.properties.get(m_texture).__webglTexture);
					if (img instanceof ImageBitmap) {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
					}
					// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, width, height, 0,
					// gl.RGB, gl.UNSIGNED_BYTE, img);

					// gl.flush();
					// if((m_texure_num % 200) == 0){
					// var elapsed_time = new Date().getTime() - st;
					// console.log("texImage2D time : " + elapsed_time + "ms");
					// }
					
					if(img.close){
						img.close();
					}

					m_texture_width = width;
					m_texture_height = height;
					m_texture_captured_time_ms = frame_info.timestamp;
					m_texture_updated_time_ms = new Date().getTime();
					
					m_updated_image = null;
					m_texure_num++;
				}
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

					if (m_scene.vertex_type == "picam360map"
						|| m_scene.vertex_type == "picam360map3d") {

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
					} else if (m_scene.vertex_type == "equirectangular") {
						var view_quat = m_view_quat.clone()
							.multiply(quat_correct);
						self.setShaderParam("unif_matrix", new THREE.Matrix4()
							.makeRotationFromQuaternion(view_quat));
					} else if (m_scene.vertex_type == "fisheye") {
						var view_quat = m_view_quat.clone()
							.multiply(quat_correct);
						self.setShaderParam("unif_matrix", new THREE.Matrix4()
							.makeRotationFromQuaternion(view_quat));
						self.setShaderParam("tex_aspect_ratio", m_texture_height / m_texture_width);
					}

					if (m_scene.view_fov_cache != m_view_fov) {
						m_scene.view_fov_cache = m_view_fov;
						var window_aspect = (stereoEnabled
							? m_canvas.width / 2
							: m_canvas.width)
							/ m_canvas.height;
						var fov_rad = m_view_fov * Math.PI / 180.0;
						var fov_gain = Math.tan(fov_rad / 2);
						var scale = 1.0 / fov_gain;
						if (window_aspect < 1.0) {
							self.setShaderParam("frame_scalex", scale / window_aspect);
							self.setShaderParam("frame_scaley", scale);
						} else {
							self.setShaderParam("frame_scalex", scale);
							self.setShaderParam("frame_scaley", scale * window_aspect);
						}
						self.setShaderParam("view_fov", m_view_fov);
						self.setShaderParam("pixel_size_x", 1.0 / m_texture_width);
						self.setShaderParam("pixel_size_y", 1.0 / m_texture_height);
						self.setShaderParam("vr_mode", stereoEnabled ? true : false);
					}
				}

				var view_quat = new THREE.Quaternion(
						-m_view_quat._x, m_view_quat._y, -m_view_quat._z, m_view_quat._w);
				m_camera.target = new THREE.Vector3(0, -1, 0).applyQuaternion(view_quat);
				m_camera.up = new THREE.Vector3(0, 0, 1).applyQuaternion(view_quat);
				m_camera.lookAt(m_camera.target);
				m_camera.aspect = m_canvas.width / m_canvas.height;
				//difference of opengl and picam360 fov spec
				m_camera.fov = m_view_fov / (m_camera.aspect > 1 ? m_camera.aspect : 1);
				m_camera.updateProjectionMatrix();
				
				if (stereoEnabled) {
					var size = m_renderer.getSize(new THREE.Vector2());
					var w = size.width / 2;
					var h = size.height;
					
					m_renderer.autoClear = false;

					var ratio = m_vr_margin/100;// %
					//left
					self.setShaderParam("eye_index", 0);
					self.setShaderParam("eye_offset", -m_eye_offset);
					m_renderer.setViewport(w*ratio, h*ratio, w*(1.0-ratio*2), h*(1.0-ratio*2));
					m_renderer.render(m_scene, m_camera);
					
					var camera_l = m_camera.clone();
					camera_l.position.copy(new THREE.Vector3(10, 0, 0).applyQuaternion(view_quat));
					camera_l.aspect = w / h;
					//difference of opengl and picam360 fov spec
					camera_l.fov = m_view_fov / (camera_l.aspect > 1 ? camera_l.aspect : 1);
					camera_l.updateProjectionMatrix();
					m_renderer.render(m_scene_overlay, camera_l);

					//right
					self.setShaderParam("eye_index", 1);
					self.setShaderParam("eye_offset", m_eye_offset);
					m_renderer.setViewport(w + w*ratio, h*ratio, w*(1.0-ratio*2), h*(1.0-ratio*2));
					m_renderer.render(m_scene, m_camera);

					var camera_r = m_camera.clone();
					camera_r.position.copy(new THREE.Vector3(-10, 0, 0).applyQuaternion(view_quat));
					camera_r.aspect = w / h;
					//difference of opengl and picam360 fov spec
					camera_r.fov = m_view_fov / (camera_r.aspect > 1 ? camera_r.aspect : 1);
					camera_r.updateProjectionMatrix();
					m_renderer.render(m_scene_overlay, camera_r);
				} else {
					var size = m_renderer.getSize(new THREE.Vector2());
					
					m_renderer.autoClear = false;
					
					self.setShaderParam("eye_index", 0);
					self.setShaderParam("eye_offset", 0);
					m_renderer.setViewport(0, 0, size.width, size.height);
					m_renderer.render(m_scene, m_camera);
					
					m_renderer.render(m_scene_overlay, m_camera);
				}
// var gl = m_renderer.getContext();
// if(gl && gl.flush){
// gl.flush();
// }
				{// latency
					var now = new Date().getTime();
					var latency_msec = now - m_texture_captured_time_ms;
					if(m_latency_msec == 0){
						m_latency_msec = latency_msec;
					} else {
						m_latency_msec = m_latency_msec * 0.9 + latency_msec * 0.1;
					}
					if((m_animate_num % 200) == 0){
						var lag_time = now - m_texture_updated_time_ms;
						console.log("latency from capture to animate : " + m_latency_msec + "ms, " + lag_time + "ms");
					}
				}
				m_animate_num++;
			},

			setStereoEnabled : function(value) {
				stereoEnabled = value;
				m_scene.view_fov_cache = 0; // cache clear
				self.setShaderParam("vr_mode", value ? true : false);
			},

			setEyeOffset : function(value) {
				m_eye_offset = value;
			},

			get_latency_msec : function() {
				return m_latency_msec;
			},
		};
		return self;
	}
	return OMVR;
})();