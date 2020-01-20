var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

	return function(plugin_host) {
		m_plugin_host = plugin_host;
		
		var loader = new THREE.AMFLoader();
		loader.load( 'img/arrow.amf', function ( mesh ) {
			mesh.position.set( 0.0, -1000.0, 0.0 );
			mesh.rotation.set( 0, 0, 0 );
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.scale.set(10,10,10);
			setInterval(()=>{
				if(mesh.position.z > 2000){
					mesh.position.z = 1;
				}else{
					mesh.position.z += 50;
				}
				mesh.rotation.set( 0, 0, mesh.position.z/300 );
			},50);
			m_plugin_host.add_overlay_object( mesh );
        } );
		
		var plugin = {};
		return plugin;
	}
})();