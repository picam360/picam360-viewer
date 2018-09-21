Worker = undefined;
importScripts("../lib/libde265/libde265.js");

var annexb_sc = new Uint8Array(4);
annexb_sc[0] = 0;
annexb_sc[1] = 0;
annexb_sc[2] = 0;
annexb_sc[3] = 1;

var options = {
	rgb : false,
	reuseMemory : true
};
var decoder = new libde265.Decoder(options);
decoder.set_image_callback(function(image) {
	var image_buf = image.get_yuv();
	postMessage({
		buf : image_buf.buffer,
		width : image.get_width(),
		height : image.get_height()
	}, [image_buf.buffer]); // Send data to our worker.
});
self.addEventListener('message', function(e) {
	var nal_buffer = new Uint8Array(e.data.buf);
	decoder.push_data(annexb_sc);
	decoder.push_data(nal_buffer);
	decoder.flush();
	decoder.decode(function(err) {
		switch (err) {
			case libde265.DE265_ERROR_WAITING_FOR_INPUT_DATA :
				console.log("waiting");
				return;

			default :
				if (!libde265.de265_isOK(err)) {
					console.log(libde265.de265_get_error_text(err));
					return;
				}
		}
	});
});