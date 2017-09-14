//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;
uniform float tex_scalex;
uniform float tex_scaley;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

varying vec2 tcoord;
varying vec4 pos;

void main(void) {
	float x = position.x / position.z;
	float y = position.y / position.z;
	gl_Position = vec4(x * frame_scalex, y * frame_scaley, 1.0, 1.0);

	pos = unif_matrix * vec4(position, 1.0);

	float tex_x = pos.x / pos.z;
	float tex_y = pos.y / pos.z;
	tcoord = (vec2(tex_x * tex_scalex, tex_y * tex_scaley) + vec2(1, 1)) * vec2(0.5, 0.5);
}
