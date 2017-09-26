//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

varying vec2 tcoord;

void main(void) {
	float x = position.x / position.z;
	float y = position.y / position.z;
	gl_Position = vec4(x * frame_scalex, y * frame_scaley, 1.0, 1.0);

	tcoord = (vec2(x, y) + vec2(1, 1)) * vec2(0.5, 0.5);
}
