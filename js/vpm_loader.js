function VpmLoader(base_path, get_view_quaternion, callback) {
	var m_base_path = base_path;
	var m_get_view_quaternion = get_view_quaternion;
	var m_frame_callback = callback;
	var m_view_quat = new THREE.Quaternion();
	var m_framecount = 0;
	var m_loaded_framecount = 0;
	var m_fps = 5;
	var m_split_p = 2;

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.responseType = "arraybuffer";
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			if(req.status == 404){
				if(m_loaded_framecount == 0){
					console.log("not found : " + req.responseURL);
					clearInterval(m_timer);
				}else{
					console.log("repeat");
					m_framecount = 0;
				}
				return;
			}
			m_loaded_framecount++;
			callback(new Uint8Array(req.response));
		}
	}
	
	var m_timer = setInterval(() => {
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
		var z = 0;
		var p_angle = 90/m_split_p;
		var p = Math.round(x/p_angle);
		var _p = (p <= m_split_p) ? p : m_split_p * 2 - p;
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
		var path = m_base_path + "/" + x + "_" + y + "_" + z + "/" + m_framecount + ".pif";
		console.log(path);
		loadFile(path, (data) => {
			if(m_frame_callback){
				m_frame_callback(data);
			}
		});
	}, 1000/m_fps);
	
	var self = {
	}; // self
	return self;
}