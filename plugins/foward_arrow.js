var create_plugin = (function() {
	var m_plugin_host = null;
	var m_is_init = false;

	return function(plugin_host) {
		m_plugin_host = plugin_host;
		
		var loader = new THREE.STLLoader();
		loader.load( 'img/arrow.stl', function ( geometry ) {
			var material = new THREE.MeshPhongMaterial( { color: 0xa48210, specular: 0x111111, shininess: 1 } )
			var mesh = new THREE.Mesh( geometry, material );
			mesh.position.set( 0.0, -1000.0, 0.0 );
			mesh.rotation.set( Math.PI / 2, 0,  Math.PI / 2 );
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.scale.set(10,10,10);
			setInterval(()=>{
				if(mesh.position.z > 2000){
					mesh.position.z = 1;
				}else{
					mesh.position.z += 50;
			}},50);
			m_plugin_host.add_overlay_object( mesh );
        } );
		
		var plugin = {};
		return plugin;
	}
})();