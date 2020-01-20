var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

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
			callback(new Uint8Array(req.response));
		};
		req.send(null);
	}
	
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		
		loadFile('img/arrow.amf', (data) => {
			var txt = (new TextDecoder).decode(data);
			var color = [1.0, 1.0, 0.0, 0.5];
			color_tag = sprintf(
					'<color><r>%f</r><g>%f</g><b>%f</b><a>%f</a></color>',
					color[0], color[1], color[2], color[3]);
			txt = txt.replace('<object id="0">', '<object id="0">' + color_tag);
			var url = URL.createObjectURL(new Blob([txt], {
				  type: "text/plain"
			}));
			var loader = new THREE.AMFLoader();
			loader.load(url, function ( mesh ) {
				var base_pos = new THREE.Vector3(0, -1000, -500);
				var euler = new THREE.Euler(-Math.PI/2, 0, 0, "YXZ");
				var quat = new THREE.Quaternion().setFromEuler(euler);
				var pos = base_pos.clone().applyQuaternion(quat);
				mesh.position.copy( pos );
				mesh.quaternion.copy( quat );
				mesh.castShadow = true;
				mesh.receiveShadow = true;
				mesh.scale.set(10,10,10);
				setInterval(()=>{
					if(base_pos.y < -2000){
						base_pos.y = -1;
					}else{
						base_pos.y -= 50;
					}
					var euler_diff = new THREE.Euler(0, 0.1, 0, "YXZ");
					var quat_diff = new THREE.Quaternion().setFromEuler(euler_diff);
					var pos = base_pos.clone().applyQuaternion(quat);
					mesh.position.copy( pos );
					mesh.quaternion.multiply(quat_diff);
				},50);
				m_plugin_host.add_overlay_object( mesh );
	        } );
		});
		
		var plugin = {};
		return plugin;
	}
})();