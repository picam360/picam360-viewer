function VpmLoader(url, url_query, get_view_quaternion, callback, info_callback) {
	var m_url = url;
	var m_url_query = url_query;
	var m_get_view_quaternion = get_view_quaternion;
	var m_frame_callback = callback;
	var m_info_callback = info_callback;
	var m_loaded_framecount = 0;
	var m_options = {
			"num_per_quarter" : 3,
			"fps" : 10,
			"keyframe_interval" : 1,
			"keyframe_offset" : [],
	};
	var m_zip_entries = null;
	
	var m_view_quat = new THREE.Quaternion();
	var m_framecount = 0;
	var m_timer = null;
	var m_mbps = 0;
	var m_timestamp = new Date().getTime();
	var m_x_deg = 0;
	var m_y_deg = 0;
	var m_eos = false;

	function loadFile(url, path, callback, error_callback) {
		if(m_zip_entries){
			loadFile_from_zip(url, path, callback, error_callback);
		}else{
			loadFile_from_dir(url, path, callback, error_callback);
		}
	}

	function loadFile_from_zip(url, path, callback, error_callback) {
		if(path[0] == '/'){
			path = path.substr(1);
		}
		if(m_zip_entries[path]){
			m_zip_entries[path].getData(null, callback);
		}else{
			error_callback({responseURL:path});
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
	function request_new_frame(){
		if((m_framecount % m_options.keyframe_interval) == 0) {
			var q = m_get_view_quaternion();
			
			var v = new THREE.Vector3( 0, -1, 0 );
			v.applyQuaternion( q );
			v.r = Math.sqrt(v.x*v.x+v.z*v.z);
			
			var euler = {
				x:Math.atan2(v.r, -v.y),
				y:-Math.atan2(v.x, -v.z),
			};
			var x = parseInt(THREE.Math.radToDeg(euler.x));
			var y = parseInt(THREE.Math.radToDeg(euler.y));
			var p_angle = 90/m_options.num_per_quarter;
			var p = Math.round(x/p_angle);
			var _p = (p <= m_options.num_per_quarter) ? p : m_options.num_per_quarter * 2 - p;
			var split_y = (_p == 0) ? 1 : 4 * _p;
			var y_angle = 360/split_y;
			
			x = p*p_angle;
			y = Math.round(y/y_angle)*y_angle;
			x = (x+360)%360;
			y = (y+360)%360;
			if(x == 0 || x == 180) {
				y = 0;
			}
			m_x_deg = x;
			m_y_deg = y;
		}
		
		++m_framecount;
		var path = "/" + m_x_deg + "_" + m_y_deg + "/" + m_framecount + ".pif";
		// console.log(path);
		loadFile(m_url, path, (data) => {
			if(m_loaded_framecount == 0){
				console.log("start");
				if(m_info_callback){
					m_info_callback("sos");
				}
			}
			m_loaded_framecount++;
			
			var now = new Date().getTime();
			var elapsed = now - m_timestamp;
			var wait_ms = 1000 / Math.max(m_options.fps, 0.1) - elapsed;
			var delay_func = function(){
				var now = new Date().getTime();
				var elapsed = now - m_timestamp;
				elapsed = Math.max(elapsed, 1);
				{// bitrate
					var mbps = 8 * data.byteLength / elapsed / 1000;
					if(m_mbps == 0){
						m_mbps = mbps;
					}else{
						m_mbps = m_mbps*0.9+mbps*0.1;
					}
				}
				if(m_frame_callback){
					m_frame_callback(data);
				}
				m_timestamp = now;
				request_new_frame();
			}
			if(wait_ms <= 0){
				delay_func();
			}else{
				setTimeout(delay_func, wait_ms);
			}
		}, (req) => {
			if(m_loaded_framecount == 0){
				console.log("not found : " + req.responseURL);
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
	var init = function(){
		loadFile(m_url, "/config.json", (data)=>{
			var options = {};
			var txt = (new TextDecoder).decode(data);
			if (txt) {
				options = JSON.parse(txt);
			}
			m_options = Object.assign(m_options, options);
			request_new_frame();
			m_timer = setInterval(() => {
			}, 1000/m_options.fps);
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
	}; // self
	return self;
}