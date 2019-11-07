Worker = undefined;
importScripts("../../lib/three/three.js");
importScripts("omvr.js");

var m_omvr = null;
self.addEventListener('message', function(e) {
	switch (e.data.type) {
		case 'init' :
			e.data.options.canvas.style = {
				width : 0,
				height : 0,
			};
			e.data.options.callback = function() {
				postMessage({
					type : 'init_done'
				});
			};

			m_omvr = new OMVR();
			m_omvr.init(e.data.options);
			break;
		case 'setCanvasSize':
			m_omvr.setCanvasSize(e.data.width, e.data.height);
			break;
		case 'setStereoEnabled':
			m_omvr.setStereoEnabled(e.data.value);
			break;
		case 'setTextureRawYuv':
			m_omvr.setTextureRawYuv(e.data.vertex_type, e.data.data, e.data.width, e.data.height, e.data.quat, e.data.fov, e.data.uuid, e.data.timestamp);
			break;
		case 'setTextureRawRgb':
			m_omvr.setTextureRawRgb(e.data.vertex_type, e.data.data, e.data.width, e.data.height, e.data.quat, e.data.fov, e.data.uuid, e.data.timestamp);
			break;
		case 'setTextureImage':
			m_omvr.setTextureImage(e.data.vertex_type, e.data.data, e.data.quat, e.data.fov, e.data.uuid, e.data.timestamp);
			break;
		case 'setFrameImage':
			m_omvr.setFrameImage(e.data.img, e.data.uuid, e.data.timestamp);
			break;
		case 'setFrameInfo':
			m_omvr.setFrameInfo(e.data.vertex_type, e.data.quat, e.data.fov, e.data.uuid, e.data.timestamp);
			break;
		case 'animate':
			m_omvr.animate(e.data.fov, e.data.quat);
			break;
	}
});