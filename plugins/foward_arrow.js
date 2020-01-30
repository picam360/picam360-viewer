var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;
	var FACTOR = 10;// related to stereo

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
	
	function arrow_effect(branch, mesh){
		var now = new Date().getTime();
		var euler = new THREE.Euler(THREE.Math.degToRad(-branch.dir[0]), THREE.Math
				 .degToRad(branch.dir[1]), THREE.Math.degToRad(branch.dir[2]), "YXZ");
		var quat = new THREE.Quaternion().setFromEuler(euler);
		var pos = new THREE.Vector3(0, -100*FACTOR, 0).applyQuaternion(quat);
		mesh.position.copy( pos );
		mesh.quaternion.copy( quat );
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		var euler_diff = new THREE.Euler(-Math.PI/8, 0, 0, "YXZ");
		var quat_diff = new THREE.Quaternion().setFromEuler(euler_diff);
		mesh.quaternion.multiply(quat_diff);

		var vec = new THREE.Vector3(0, -100*FACTOR, 0).applyQuaternion(mesh.quaternion);
		var base = pos.sub(vec);
		var hz = 1;
		var k = (now%(1000/hz))/(1000/hz);
		pos = base.add(vec.multiplyScalar(k));
		mesh.position.copy( pos );
		var scale = FACTOR*(branch.marker_scale||1);
		mesh.scale.set(scale, scale, scale);
		mesh.material.opacity = 0.75;
	}
	
	function load_stl(url, callback){
		var loader = new STLLoader();
		loader.load(url, function ( geometry ) {
			var material = new THREE.MeshPhongMaterial( { 
				transparent: true, opacity: 0.5, color: 0xffff00, specular: 0x111111, shininess: 200 } );
			var mesh = new THREE.Mesh( geometry, material );
			callback(mesh);
		});
	}
	
	function load_amf(_url, callback){
		loadFile(_url, (data) => {
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
				callback(mesh);
			});
		});
	}
	
	return function(plugin_host) {
		m_plugin_host = plugin_host;
		
		var branch = {
			"marker" : "img/arrow2.stl",
			"dir" : [90, 0, 0]
		}
		var loader;
		if(branch.marker.endsWith(".amf")){
			loader = load_amf;
		}else if(branch.marker.endsWith(".stl")){
			loader = load_stl;
		}else if(branch.marker.endsWith(".svg")){
			loader = load_svg;
		}
		loader(branch.marker, function(mesh){
			mesh.material.opacity = 0.0;
			m_plugin_host.add_overlay_object( mesh );
			setInterval(()=>{
				arrow_effect(branch, mesh);
			},50);
        } );
		
		var plugin = {};
		return plugin;
	}
})();