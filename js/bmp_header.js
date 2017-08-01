function get_bmp_header(width, height, depth) {
	var header_size = depth <= 8 ? 54 + Math.pow(2, depth) * 4 : 54;
	var buffer = new ArrayBuffer(header_size);
	var view = new DataView(buffer);
	var bytes_in_pixel = depth / 8;
	var bytes_os_pixels = width * height * bytes_in_pixel;

	// BMP Header
	view.setUint8(0, 'BM'.charCodeAt(0)); // ID field
	view.setUint8(1, 'BM'.charCodeAt(1)); // ID field
	view.setUint32(2, header_size + bytes_os_pixels, true); // BMP size
	view.setUint32(6, 0, true); // unused
	view.setUint32(10, header_size, true); // pixel data offset

	// DIB Header
	view.setUint32(14, 40, true); // DIB header length
	view.setUint32(18, width, true); // image width
	view.setUint32(22, height, true); // image height
	view.setUint16(26, 1, true); // colour panes
	view.setUint16(28, depth, true); // bits per pixel
	view.setUint32(30, 0, true);// compression method
	view.setUint32(34, bytes_os_pixels, true);// size of the raw data
	view.setUint32(38, 2835, true);// horizontal print resolution
	view.setUint32(42, 2835, true); // vertical print resolution
	view.setUint32(46, 0, true); // colour palette, 0 == 2^n
	view.setUint32(50, 0, true); // important colours

	// Grayscale tables for bit depths <= 8
	if (depth <= 8) {
		var offset = 54;
		view.setUint32(offset, 0, true);
		offset += 4;

		for (var s = Math.floor(255 / (Math.pow(2, depth) - 1)), i = s; i < 256; i += s) {
			view.setUint32(offset, i + (i << 8) + (i << 16), true);
			offset += 4;
		}
	}

	return new Uint8Array(buffer);
}