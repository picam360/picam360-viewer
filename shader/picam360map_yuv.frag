uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;

varying vec2 tcoord;

void main(void) {
	float y = texture2D(tex_y, tcoord).r;
	float u = texture2D(tex_u, tcoord).r;
	float v = texture2D(tex_v, tcoord).r;
	gl_FragColor = vec4(y, u, v, 1) * YUV2RGB;
}
