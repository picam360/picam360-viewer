Worker = undefined;
importScripts("../lib/libopus/opus-stream-decoder.js");

var options = {};
var decoder = null;
var _decoder = new OpusStreamDecoder({
	onDecode : function(res) {
		postMessage({
			left : res.left.buffer,
			right : res.right.buffer,
		}, [res.left.buffer]); // Send data to our worker.
	}
});
_decoder.ready.then(function() {
	decoder = _decoder;
});
self.addEventListener('message', function(e) {
	if (decoder) {
		var buffer = new Uint8Array(e.data.buf);
		decoder.decode(buffer);
	}
});