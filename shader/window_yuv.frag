uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;

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
		float y = texture2D(tex_y, vec2(tcoord.x, tcoord.y)).r;
		float u = texture2D(tex_u, vec2(tcoord.x, tcoord.y)).r;
		float v = texture2D(tex_v, vec2(tcoord.x, tcoord.y)).r;
		gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;
	}
}
