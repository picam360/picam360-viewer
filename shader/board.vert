//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;
uniform float tex_scalex;
uniform float tex_scaley;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

varying vec2 tcoord;

void main(void) {
	gl_Position = vec4(position.x / position.z * frame_scalex, position.y / position.z * frame_scaley, 1.0, 1.0);

	vec4 pos = unif_matrix * vec4(position, 1.0);

	tcoord = (vec2(pos.x / pos.z * tex_scalex, pos.y / pos.z * tex_scaley) + vec2(1, 1)) * vec2(0.5, 0.5);
}
