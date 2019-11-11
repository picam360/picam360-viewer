varying vec2 tcoord;
uniform sampler2D tex;

void main(void) {
	if (tcoord.x < 0.0 || tcoord.x > 1.0 || tcoord.y < 0.0 || tcoord.y > 1.0) {
		gl_FragColor = vec4(0, 0, 0, 1);
	} else {
		gl_FragColor = texture2D(tex, vec2(tcoord.x,1.0-tcoord.y));
	}
}
