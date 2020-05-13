function VpmLoader(url, url_query, get_view_quaternion, callback, info_callback) {
	var m_url = url;
	var m_url_query = url_query;
	var m_get_view_quaternion = get_view_quaternion;
	var m_frame_callback = callback;
	var m_info_callback = info_callback;
	var m_options = {
			"num_per_quarter" : 3,
			"fps" : 10,
			"keyframe_interval" : 1,
			"keyframe_offset" : [],
	};
	var m_view_points = [];
	var m_zip_entries = null;
	var m_frames = {};
	var m_loaded_framecount = 0;
	var m_request_framecount = 0;
	var m_stream_framecount = 0;
	var m_request_loop_timer = null;
	var m_stream_loop_timer = null;
	
	var m_view_quat = new THREE.Quaternion();
	var m_mbps = 0;
	var m_bytes_in_1000ms = 0;
	var m_timestamp = new Date().getTime();
	var m_yaw = 0;
	var m_pitch = 0;
	var m_eos = false;

	var m_preload_factor = 2;// 2sigma:95%
	var m_preload = 30;
	var m_loading_count_in_1000ms = 0;
	var m_loading_total_in_1000ms = 0;
	var m_loading_total2_in_1000ms = 0;
	var m_loading_ave = 0;
	var m_loading_ave2 = 0;

	function loadFile(url, path, callback, error_callback) {
		if(m_zip_entries){
			loadFile_from_zip(url, path, callback, error_callback);
		}else{
			loadFile_from_dir(url, path, callback, error_callback);
		}
	}

	function Uint8ArrayWriter() {
		var data;
		var that = this

		function init(callback) {
			callback();
		}

		function writeUint8Array(array, callback) {
			data = array;
			callback();
		}

		function getData(callback) {
			callback(data);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	Uint8ArrayWriter.prototype = new zip.Writer();
	Uint8ArrayWriter.prototype.constructor = Uint8ArrayWriter;

	function loadFile_from_zip(url, path, callback, error_callback) {
		if(path[0] == '/'){
			path = path.substr(1);
		}
		if(m_zip_entries[path]){
			m_zip_entries[path].getData(null, callback, error_callback); // decrease
																			// request
																			// count
			// m_zip_entries[path].getData(new Uint8ArrayWriter(), callback,
			// error_callback);
		}else{
			error_callback({code:"NO_ENTRY",responseURL:path});
		}
	}
	
	function loadFile_from_dir(url, path, callback, error_callback) {
		var req = new XMLHttpRequest();
		req.responseType = "arraybuffer";
		req.open("get", url + path, true);

		req.onerror = function() {
			if(error_callback){
				error_callback(req);
			}
			return;
		};
		req.onload = function() {
			if(req.status != 200){
				req.onerror();
				return;
			}
			callback(new Uint8Array(req.response));
		};
		req.send(null);
	}
	function request_frame(pitch, yaw, framecount, offset, num, try_count, callback){
		var path;
		if(m_options.frame_pack_size){
			var bnum = Math.floor((framecount-1)/m_options.frame_pack_size) + 1;
			path = "/" + pitch + "_" + yaw + "/" + bnum + ".bson";
		}else {
			path = "/" + pitch + "_" + yaw + "/" + framecount + ".pif";
		}
		var st = new Date().getTime();
		// console.log(path);
		loadFile(m_url, path, (data) => {
			var now = new Date().getTime();
			
			if(m_loaded_framecount == 0){
				console.log("start");
				if(m_info_callback){
					m_info_callback("sos");
				}
			}
			if(m_options.frame_pack_size){
				var ary;
				try{
					ary = BSON.deserialize(data);
				}catch{
					console.log("bson coruption");
					ary = {};
				}
				for(var i=offset;i<offset+num;i++){
					m_loaded_framecount++;
					if(ary[i]){
						m_frames[framecount+i] = new Uint8Array(ary[i].buffer);
					}else{
						m_frames[framecount+i] = null;
					}
			    }
			}else{
				m_loaded_framecount++;
				m_frames[framecount] = data;
			}
			var loading_time = now - st;
			m_loading_count_in_1000ms++;
			m_loading_total_in_1000ms += loading_time;
			m_loading_total2_in_1000ms += loading_time*loading_time;
			m_bytes_in_1000ms += data.byteLength;
			var elapsed = now - m_timestamp;
			if(elapsed > 1000)
			{
				if(url_query['preload']){// fixed preload
					m_preload = parseInt(url_query['preload']);
				} else {// dynamic preload
					var preload_factor = m_preload_factor;
					if(url_query['preload-factor']){
						preload_factor = parseFloat(url_query['preload-factor']);
					}
					var ave = m_loading_total_in_1000ms / m_loading_count_in_1000ms;
					var ave2 = m_loading_total2_in_1000ms / m_loading_count_in_1000ms;
					if(m_loading_ave == 0){
						m_loading_ave = ave;
						m_loading_ave2 = ave2;
					}else{
						m_loading_ave = m_loading_ave*0.9+ave*0.1;
						m_loading_ave2 = m_loading_ave2*0.9+ave2*0.1;
					}
					var dev = Math.sqrt(m_loading_ave2 - m_loading_ave*m_loading_ave);
					var max_loading_time = Math.min(m_loading_ave+preload_factor*dev, 2000);
					var one_frame_time = 1000/m_options.fps;
					m_preload = Math.ceil(max_loading_time/one_frame_time);
				}
				{// bitrate
					var mbps = 8 * m_bytes_in_1000ms / elapsed / 1000;
					if(m_mbps == 0){
						m_mbps = mbps;
					}else{
						m_mbps = m_mbps*0.9+mbps*0.1;
					}
				}				
				m_loading_count_in_1000ms = 0;
				m_loading_total_in_1000ms = 0;
				m_loading_total2_in_1000ms = 0;
				m_bytes_in_1000ms = 0;
				m_timestamp = now;
			}
			if(callback){
				callback();
			}
		}, (err) => {
			if(err.code != "NO_ENTRY" && try_count > 0){
				request_frame(pitch, yaw, framecount, offset, num, try_count - 1, callback);
				return;
			}
			if(m_loaded_framecount == 0){
				console.log("not found : " + err.responseURL);
				if(m_info_callback){
					m_info_callback("not_found");
				}
			}else if(!m_eos){
				m_eos = true;
				console.log("end");
				if(m_info_callback){
					m_info_callback("eos");
				}
			}
		});
	}
	
	function parseBoolean(str) {
		return str == "yes" || str == "on" || str == "true" || str == "1";
	}
	
	function abs_diff_deg(deg1, deg2){
		var ret = Math.abs(deg1 - deg2) % 360;
		if(ret > 180){
			ret = 360 - ret; 
		}
		return ret;
	}
	
	function get_view_deg_raw(){
		var q = m_get_view_quaternion();
		
		var v = new THREE.Vector3( 0, -1, 0 );
		v.applyQuaternion( q );
		v.r = Math.sqrt(v.x*v.x+v.z*v.z);
		
		var pitch_rad = Math.atan2(v.r, -v.y);
		var yaw_rad = v.r == 0 ? 0 : -Math.atan2(v.x, -v.z);
		var pitch = parseInt(THREE.Math.radToDeg(pitch_rad));
		var yaw = parseInt(THREE.Math.radToDeg(yaw_rad));
		return {pitch, yaw};
	}
	
	function get_view_deg(){
		var {pitch, yaw} = get_view_deg_raw();
		var p_angle = 90/m_options.num_per_quarter;
		var p = Math.round(pitch/p_angle);
		var _p = (p <= m_options.num_per_quarter) ? p : m_options.num_per_quarter * 2 - p;
		var split_y = (_p == 0) ? 1 : 4 * _p;
		var y_angle = 360/split_y;
		
		pitch = p*p_angle;
		yaw = Math.round(yaw/y_angle)*y_angle;
		pitch = (pitch+360)%360;
		yaw = (yaw+360)%360;
		if(pitch == 0 || pitch == 180) {
			yaw = 0;
		}
		return {pitch, yaw};
	}
	
	function get_view_deg_candidates(){
		var q_target = m_get_view_quaternion();
		var v_target = new THREE.Vector3( 0, -1, 0 ).applyQuaternion( q_target );
		var q_base = new THREE.Quaternion()
			.setFromEuler(new THREE.Euler(
				THREE.Math.degToRad(m_pitch),
				THREE.Math.degToRad(m_yaw),
				THREE.Math.degToRad(0.0), "YXZ"));
		var v_base = new THREE.Vector3( 0, -1, 0 ).applyQuaternion( q_base );
		var dot_base = v_target.dot(v_base);
		var list = {};
		for(var vp of m_view_points){
			var q = new THREE.Quaternion()
				.setFromEuler(new THREE.Euler(
					THREE.Math.degToRad(vp.pitch),
					THREE.Math.degToRad(vp.yaw),
					THREE.Math.degToRad(0.0), "YXZ"));
			var v = new THREE.Vector3( 0, -1, 0 ).applyQuaternion( q );
			var dot = v_target.dot(v);
			if(dot <= dot_base){
				continue;
			}
			list[dot] = {pitch:vp.pitch, yaw:vp.yaw};
		}
		var sorted_key = [];
		for (var key in list) {
			sorted_key.push(key);
		}
		sorted_key.sort(function(a,b){
			return(b-a);
		}); 
		var sorted = [];
	    for (var key of sorted_key) {
	    	sorted.push(list[key]);
	    }
	    return sorted;
	}
	
	function start_request_loop(){
		m_request_loop_timer = setInterval(() => {
			var range = m_options.frame_pack_size || 1;
			if(m_eos){
				if(m_options.loop){
					m_eos = false;
					m_request_framecount = 0;
					m_stream_framecount = 0;
				}else{
					var {pitch, yaw} = get_view_deg();
					if(yaw != m_yaw || pitch != m_pitch){
						m_yaw = yaw;
						m_pitch = pitch;
						request_frame(m_pitch, m_yaw,
								m_request_framecount - range,
								0,
								range,
								10,
								() => {
									if(m_stream_framecount > m_request_framecount - range - 1){
										m_stream_framecount = m_request_framecount - range - 1;
									}
								});
					}
				}
				return;
			}
			if(m_request_framecount > m_stream_framecount + m_preload){
				return;
			}
			var nk_offset = 0;
			var {pitch, yaw} = get_view_deg();
			if(m_request_framecount == 0){
				m_yaw = yaw;
				m_pitch = pitch;
			}else if(yaw != m_yaw || pitch != m_pitch){
				var candidated = get_view_deg_candidates();
			    for (var vp of candidated) {
					var offset = m_options.keyframe_offset[vp.pitch + "_" + vp.yaw] || 0;
					var nk = Math.ceil((m_request_framecount - offset) / m_options.keyframe_interval) * m_options.keyframe_interval + offset;
					var _nk_offset = nk - m_request_framecount;
					if(m_request_framecount >= offset && _nk_offset < range){
						nk_offset = _nk_offset;
						if(m_options.frame_pack_size && nk_offset != 0){
							request_frame(m_pitch, m_yaw, m_request_framecount + 1, 0, nk_offset, 10);// starts_from_1
						}
						m_yaw = vp.yaw;
						m_pitch = vp.pitch;
						break;
					}
			    }
			}
			request_frame(m_pitch, m_yaw, m_request_framecount + 1, nk_offset, range - nk_offset, 10);// starts_from_1
			m_request_framecount += range;
		}, 1000/m_options.fps);
	}
	
	function start_stream_loop(){
		m_stream_loop_timer = setInterval(() => {
			if(m_frames[m_stream_framecount+1] === undefined){
				return;
			}
			m_stream_framecount++;
			var data = m_frames[m_stream_framecount];
			delete m_frames[m_stream_framecount];
			if(data === null){
				return;
			}
			if(m_frame_callback){
				m_frame_callback(data);
			}
		}, 1000/m_options.fps);
	}
	
	var init = function(){
		loadFile(m_url, "/config.json", (data)=>{
			var options = {};
			var txt = (new TextDecoder).decode(data);
			if (txt) {
				options = JSON.parse(txt);
			}
			m_options = Object.assign(m_options, options);
			if(url_query['loop']){
				m_options.loop = parseBoolean(url_query['loop']);
			}
			if(url_query['fps']){
				m_options.fps = parseFloat(url_query['fps']);
			}
			m_preload = m_options.fps;// 1sec
			{
				m_view_points = [];
				var n = m_options.num_per_quarter;
				var split_p = n * 2;
				for (var p = 0; p <= split_p; p++) {
					var _p = (p <= n) ? p : n * 2 - p;
					var split_y = (_p == 0) ? 1 : 4 * _p;
					for (var y = 0; y < split_y; y++) {
						var pitch = 180 * p / split_p;
						var yaw = 360 * y / split_y;
						m_view_points.push({pitch, yaw});
					}
				}
			}
			start_request_loop();
			start_stream_loop();
		});
	};
	
	if(m_url.toLowerCase().endsWith('.pvf') || m_url.toLowerCase().endsWith('.zip')){
		zip.useWebWorkers = false;
		zip.createReader(new zip.HttpRangeReader(m_url, m_url_query), function(zipReader) {
			zipReader.getEntries(function(entries) {
				m_zip_entries = {};
				for(var entry of entries){
					if(entry.directory){
						continue;
					}
					m_zip_entries[entry.filename] = entry;
				}
				init();
			})
		});
	} else {
		init();
	}
	
	
	var self = {
		get_bitrate_mbps : () => {
			return m_mbps;
		},
		get_preload : () => {
			var preload = m_preload + (m_options.frame_pack_size ? m_options.frame_pack_size : 0);
			var preload_act = m_request_framecount - m_stream_framecount;
			return [preload_act, preload];
		},
	}; // self
	return self;
}