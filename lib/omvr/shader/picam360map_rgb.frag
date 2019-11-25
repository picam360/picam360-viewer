varying vec2 tcoord;
uniform sampler2D tex;
uniform float eye_index;

void main(void) {
#ifdef STEREO_SIDE_BY_SIDE
	vec2 _tcoord = vec2(tcoord.x / 2.0 + eye_index * 0.5, 1.0 - tcoord.y);
#else
	vec2 _tcoord = vec2(tcoord.x, 1.0 - tcoord.y);
#endif
	gl_FragColor = texture2D(tex, _tcoord);
}
