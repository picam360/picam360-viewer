Worker = undefined;
importScripts("../../lib/three/three.js");
importScripts("omvr.js");

var m_canvas = null;
var m_omvr = null;
self.addEventListener('message', function(e) {
	switch (e.data.type) {
		case 'init' :
			var m_canvas = e.data.canvas;
			m_canvas.style = {
				width : 0,
				height : 0,
			};

			m_omvr = new OMVR();
			m_omvr.init(m_canvas, e.data.devicePixelRatio, function() {
				postMessage({
					type : 'init_done'
				});
			});
			break;
		case 'setCanvasSize':
			m_omvr.setCanvasSize(e.data.width, e.data.height);
			break;
		case 'setStereoEnabled':
			m_omvr.setStereoEnabled(e.data.value);
			break;
		case 'setTextureRawYuv':
			m_omvr.setTextureRawYuv(e.data.vertex_type, e.data.data, e.data.width, e.data.height, e.data.quat, e.data.fov);
			break;
		case 'setTextureRawRgb':
			m_omvr.setTextureRawRgb(e.data.vertex_type, e.data.data, e.data.width, e.data.height, e.data.quat, e.data.fov);
			break;
		case 'setTextureImage':
			m_omvr.setTextureImage(e.data.vertex_type, e.data.data, e.data.quat, e.data.fov);
			break;
		case 'animate':
			m_omvr.animate(e.data.fov, e.data.quat);
			break;
	}
});