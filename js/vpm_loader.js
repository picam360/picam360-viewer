function VpmLoader(base_path, get_view_quaternion, callback) {
	var m_base_path = base_path;
	var m_get_view_quaternion = get_view_quaternion;
	var m_frame_callback = callback;
	var m_loaded_framecount = 0;
	var m_options = {
			"num_per_quarter" : 3,
			"fps" : 10,
			"keyframe_interval" : 1,
			"keyframe_offset" : [],
	};
	
	var m_view_quat = new THREE.Quaternion();
	var m_framecount = 0;
	var m_timer = null;
	var m_mbps = 0;
	var m_timestamp = new Date().getTime();;

	function loadFile(path, callback, error_callbackk) {
		var req = new XMLHttpRequest();
		req.responseType = "arraybuffer";
		req.open("get", path, true);

		req.onerror = function() {
			if(error_callbackk){
				error_callbackk(req);
			}
			return;
		};
		req.onload = function() {
			if(req.status != 200){
				req.onerror();
				return;
			}
			{//bitrate
				var elapsed = new Date().getTime() - m_timestamp;
				elapsed = Math.max(elapsed, 1);
				var mbps = 8 * req.response.byteLength / elapsed / 1000;
				if(m_mbps == 0){
					m_mbps = mbps;
				}else{
					m_mbps = m_mbps*0.9+mbps*0.1;
				}
				m_timestamp = now;
			}
			m_loaded_framecount++;
			callback(new Uint8Array(req.response));
		};
		req.send(null);
	}
	loadFile(base_path+"/config.json", (data)=>{
		var options = {};
		var txt = (new TextDecoder).decode(data);
		if (txt) {
			options = JSON.parse(txt);
		}
		m_options = Object.assign(m_options, options);
		m_timer = setInterval(() => {
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
			++m_framecount;
			var path = m_base_path + "/" + x + "_" + y + "/" + m_framecount + ".pif";
			// console.log(path);
			loadFile(path, (data) => {
				if(m_frame_callback){
					m_frame_callback(data);
				}
			}, (req) => {
				if(m_loaded_framecount == 0){
					console.log("not found : " + req.responseURL);
					clearInterval(m_timer);
				}else{
					console.log("repeat");
					m_framecount = 0;
				}
			});
		}, 1000/m_options.fps);
	})
	
	
	var self = {
		get_bitrate_mbps : () => {
			return m_mbps;
		},
	}; // self
	return self;
}