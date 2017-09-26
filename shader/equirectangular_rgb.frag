uniform sampler2D tex;

const float M_PI = 3.1415926535;

varying vec4 pos;
varying float tcoord_y;

void main(void) {
	float yaw = atan(pos.x, pos.z);
	float tcoord_x = -yaw / (M_PI * 2.0) + 0.5;
	vec2 tcoord = vec2(tcoord_x, tcoord_y);

	if (tcoord.x < 0.0 || tcoord.x > 1.0 || tcoord.y < 0.0 || tcoord.y > 1.0) {
		gl_FragColor = vec4(0, 0, 0, 1);
	} else {
		gl_FragColor = texture2D(tex, vec2(tcoord.x, tcoord.y));
	}
}
