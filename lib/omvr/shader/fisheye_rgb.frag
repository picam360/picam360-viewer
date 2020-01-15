uniform sampler2D tex;

const float M_PI = 3.1415926535;

varying vec3 cam_uvr;

void main(void) {
	float r_thresh = 220.0 / 360.0;
	if (cam_uvr[2] > r_thresh || cam_uvr[0] <= 0.0 || cam_uvr[0] > 1.0
			|| cam_uvr[1] <= 0.0 || cam_uvr[1] > 1.0) {
		gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
	} else {
		gl_FragColor = texture2D(tex, vec2(cam_uvr[0], cam_uvr[1]));
	}
}
