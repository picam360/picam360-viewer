uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;
uniform float eye_index;
uniform float pixel_size_x;
uniform float pixel_size_y;
uniform float xstart;
uniform float xend;

varying vec2 tcoord;
varying float resolution;

// w0, w1, w2, and w3 are the four cubic B-spline basis functions
float w0(float a)
{
    return (1.0/6.0)*(a*(a*(-a + 3.0) - 3.0) + 1.0);
}

float w1(float a)
{
    return (1.0/6.0)*(a*a*(3.0*a - 6.0) + 4.0);
}

float w2(float a)
{
    return (1.0/6.0)*(a*(a*(-3.0*a + 3.0) + 3.0) + 1.0);
}

float w3(float a)
{
    return (1.0/6.0)*(a*a*a);
}

// g0 and g1 are the two amplitude functions
float g0(float a)
{
    return w0(a) + w1(a);
}

float g1(float a)
{
    return w2(a) + w3(a);
}

// h0 and h1 are the two offset functions
float h0(float a)
{
    return -1.0 + w1(a) / (w0(a) + w1(a));
}

float h1(float a)
{
    return 1.0 + w3(a) / (w2(a) + w3(a));
}
vec4 texture2D_yuv(vec2 uv){
	vec2 uv_y = uv;
	vec2 uv_uv = uv;
	if(uv_uv.x > xend - pixel_size_x){
		uv_uv.x = xend - pixel_size_x;
		if(uv_y.x > xend - pixel_size_x/2.0){
			uv_y.x = xend - pixel_size_x/2.0;
		}
	}
	float y = texture2D(tex_y, uv_y).r;
	float u = texture2D(tex_u, uv_uv).r;
	float v = texture2D(tex_v, uv_uv).r;
	return vec4(y, u, v, 1) * YUV2RGB;
}

vec4 texture2D_bicubic(vec2 uv, vec2 res)
{
	uv = uv*res + 0.5;
	vec2 iuv = floor( uv );
	vec2 fuv = fract( uv );

    float g0x = g0(fuv.x);
    float g1x = g1(fuv.x);
    float h0x = h0(fuv.x);
    float h1x = h1(fuv.x);
    float h0y = h0(fuv.y);
    float h1y = h1(fuv.y);

	vec2 p0 = (vec2(iuv.x + h0x, iuv.y + h0y) - 0.5) / res;
	vec2 p1 = (vec2(iuv.x + h1x, iuv.y + h0y) - 0.5) / res;
	vec2 p2 = (vec2(iuv.x + h0x, iuv.y + h1y) - 0.5) / res;
	vec2 p3 = (vec2(iuv.x + h1x, iuv.y + h1y) - 0.5) / res;
	
    return g0(fuv.y) * (g0x * texture2D_yuv(p0)  +
                        g1x * texture2D_yuv(p1)) +
           g1(fuv.y) * (g0x * texture2D_yuv(p2)  +
                        g1x * texture2D_yuv(p3));
}

void main(void) {
	float y = 1.0 - tcoord.y;
#ifdef STEREO_SIDE_BY_SIDE
	float x = tcoord.x / 2.0 + eye_index * 0.5;
#else
	float x = tcoord.x;
#endif
	x = x * (xend - xstart) + xstart;
	vec2 _tcoord = vec2(x, y);
	
	//gl_FragColor = texture2D_yuv(_tcoord);
	if(resolution == 1.0){
		gl_FragColor = texture2D_yuv(_tcoord);
	}else{
		gl_FragColor = texture2D_bicubic(_tcoord, vec2(1.0/pixel_size_x, 1.0/pixel_size_y));
	}
}
