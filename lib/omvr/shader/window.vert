//position is windowed sphere

varying vec2 tcoord;

void main(void) {
	gl_Position = vec4(position.xy, 1.0, 1.0);

	tcoord = (position.xy + vec2(1, 1)) * vec2(0.5, 0.5);
}
