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
			m_zip_entries[path].getData(null, callback, error_callback);
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
	function request_frame(x_deg, y_deg, framecount, count){
		var path = "/" + x_deg + "_" + y_deg + "/" + framecount + ".pif";
		// console.log(path);
		loadFile(m_url, path, (data) => {
			if(m_loaded_framecount == 0){
				console.log("start");
				if(m_info_callback){
					m_info_callback("sos");
				}
			}
			m_loaded_framecount++;
			m_frames[framecount] = data;
			
			m_bytes_in_1000ms += data.byteLength;
			
			var now = new Date().getTime();
			var elapsed = now - m_timestamp;
			if(elapsed > 1000)
			{// bitrate
				var mbps = 8 * m_bytes_in_1000ms / elapsed / 1000;
				if(m_mbps == 0){
					m_mbps = mbps;
				}else{
					m_mbps = m_mbps*0.9+mbps*0.1;
				}
				m_timestamp = now;
				m_bytes_in_1000ms = 0;
			}
		}, (err) => {
			if(err.code != "NO_ENTRY" && count < 10){
				request_frame(x_deg, y_deg, framecount, count + 1);
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
		return str == "yes" || str == "on" || str == "true";
	}
	
	function start_request_loop(){
		m_request_loop_timer = setInterval(() => {
			if(m_eos){
				if(m_options.loop){
					m_eos = false;
					m_request_framecount = 0;
					m_stream_framecount = 0;
				}else{
					clearInterval(m_stream_loop_timer);
					clearInterval(m_stream_loop_timer);
				}
				return;
			}
			if(m_request_framecount > m_stream_framecount + 5){
				return;
			}
			if((m_request_framecount % m_options.keyframe_interval) == 0) {
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
			++m_request_framecount;// starts from 1
			request_frame(m_x_deg, m_y_deg, m_request_framecount, 1);
		}, 1000/m_options.fps);
	}
	
	function start_stream_loop(){
		m_stream_loop_timer = setInterval(() => {
			if(m_frames[m_stream_framecount+1] == null){
				return;
			}
			m_stream_framecount++;
			var data = m_frames[m_stream_framecount];
			m_frames[m_stream_framecount] = undefined;
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
	}; // self
	return self;
}