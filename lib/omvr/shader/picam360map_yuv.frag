uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;
uniform float eye_index;
uniform float pixel_size_x;
uniform float pixel_size_y;

varying vec2 tcoord;

void main(void) {
#ifdef STEREO_SIDE_BY_SIDE
	vec2 _tcoord = vec2(tcoord.x / 2.0 + eye_index * 0.5, 1.0 - tcoord.y);
#else
	vec2 _tcoord = vec2(tcoord.x, 1.0 - tcoord.y);
#endif
	float y = texture2D(tex_y, _tcoord).r;
	float u = texture2D(tex_u, _tcoord).r;
	float v = texture2D(tex_v, _tcoord).r;
	gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;
}
