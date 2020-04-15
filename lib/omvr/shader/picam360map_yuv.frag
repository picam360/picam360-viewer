uniform sampler2D tex_y;
uniform sampler2D tex_u;
uniform sampler2D tex_v;
uniform mat4 YUV2RGB;
uniform float eye_index;
uniform float texture_width;
uniform float texture_height;
uniform float xstart;
uniform float xend;

varying vec2 tcoord;
varying float resolution;
varying float boundary;

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

vec2 validate_uv(vec2 uv){
	for(int i=0;i<2;i++){
		if(uv[i] < 0.0){
			uv[i] = 0.0 - uv[i];
			uv[1-i] = 1.0 - uv[1-i];
			//return vec2(0.5,0.5);
		}
		if(uv[i] > 1.0){
			uv[i] = 2.0 - uv[i];
			uv[1-i] = 1.0 - uv[1-i];
			//return vec2(0.5,0.5);
		}
	}
	return uv;
}

vec4 texture2D_yuv(vec2 uv, int border){
	if(border == 1){
		uv = validate_uv(uv);
	}
	vec2 res = vec2(texture_width, texture_height);//change coodinates
	uv = (uv - 0.5) / (1.0 + 1.0/res) + 0.5;//change coodinates
	
	uv.y = 1.0 - uv.y;
//#ifdef STEREO_SIDE_BY_SIDE
//	uv_y.x = uv_y.x / 2.0 + eye_index * 0.5;
//#endif
//	uv_y.x = uv_y.x * (xend - xstart) + xstart;
//	if(uv_y.x > xend){
//		uv_y.x = xend;
//	}
	
	float y = texture2D(tex_y, uv).r;
	float u = texture2D(tex_u, uv).r;
	float v = texture2D(tex_v, uv).r;
	return vec4(y, u, v, 1.0) * YUV2RGB;
}

void texture2D_4x4(vec4 out_pixels[16], float out_x[1], float out_y[1], float x, float y) { //x,y[0-1]
	int xbi = int(x) - 1;
	int ybi = int(y) - 1;
	for(int i=0;i<4;i++){
		for(int j=0;j<4;j++){
			int x2 = xbi + j;
			int y2 = ybi + i;
			if(x2 < 0){
				x2 = 0;
			}
			if(x2 >= int(texture_width)){
				x2 = int(texture_width) - 1;
			}
			if(y2 < 0){
				y2 = 0;
			}
			if(y2 >= int(texture_height)){
				y2 = int(texture_height) - 1;
			}
			out_pixels[4*i + j] = texture2D_yuv(vec2(float(x2)/(texture_width - 1.0), float(y2)/(texture_height - 1.0)), 0);
		}
	}
	out_x[0] = x - float(xbi) - 1.5;
	out_y[0] = y - float(ybi) - 1.5;
}

//##################### bicubic #####################//
#define BICUBIC_A -0.5
//float cubic_weight(float x, float a) {
//	float d = abs(x);
//	if(d <= 1.0){
//		return (a + 2.0)*d*d*d - (a + 3.0)*d*d + 1.0;
//	}else if(d < 2.0){
//		return a*d*d*d - 5.0*a*d*d + 8.0*a*d - 4.0*a;
//	}else{
//		return 0.0;
//	}
//}
float cubic_weight(float x, float a) {
	float d = abs(x);
	if(d <= 1.0){
		return 2.0/3.0 - d*d*(2.0-d)/2.0;
	}else if(d < 2.0){
		float _d = (2.0-d);
		return _d*_d*_d/6.0;
	}else{
		return 0.0;
	}
}
vec4 cubic_interpolation(float x, float a, vec4 pixels[4]) {
	vec4 v = vec4(0.0);
	float w_all = 0.0;
	for(int i=0;i<4;i++){
		float w = cubic_weight((float(i)-1.5)-x, a);
		v += w * pixels[i];
		w_all += w;
	}
	return v / w_all;
}

const float of = 0.0;
vec4 texture2D_border(vec2 uv)
{
	vec2 res = vec2(texture_width - 1.0, texture_height - 1.0);
	
	uv = uv*res + of;
	vec2 iuv = floor( uv );
	vec2 fuv = fract( uv );
	for(int i=0;i<2;i++){
		if(iuv[i] < 0.0){
			iuv[i] = 0.0;
			fuv[i] = 0.0;
			//return vec4(0.0,0.0,0.0,1.0);
		}else if(iuv[i] < 1.5 && iuv[i] >= 1.0){
			iuv[i] = 0.0;
			fuv[i] = 1.0;
			//return vec4(0.0,0.0,0.0,1.0);
		}
		if(iuv[i] >= res[i]){
			iuv[i] = res[i] - 1.0;
			fuv[i] = 1.0;
			//return vec4(0.0,0.0,0.0,1.0);
		}else if(iuv[i] >= res[i] - 2.5 && iuv[i] <= res[i] - 2.0){
			iuv[i] = res[i] - 1.0;
			fuv[i] = 0.0;
			//return vec4(0.0,0.0,0.0,1.0);
		}
	}
	vec4 ypixels[4];
	int xbi = int(iuv.x) - 1;
	int ybi = int(iuv.y) - 1;
	float _x = uv.x - float(xbi) - 1.5;
	float _y = uv.y - float(ybi) - 1.5;
	for(int i=0;i<4;i++){
		vec4 xpixels[4];
		for(int j=0;j<4;j++){
			int x2 = xbi + j;
			int y2 = ybi + i;
			if(x2 < 0){
				x2 = -x2;
				y2 = int(texture_height) - 1 - y2;
			}
			if(x2 >= int(texture_width)){
				x2 = 2*(int(texture_width) - 1) - x2;
				y2 = int(texture_height) - 1 - y2;
			}
			if(y2 < 0){
				y2 = -y2;
				x2 = int(texture_width) - 1 - x2;
			}
			if(y2 >= int(texture_height)){
				y2 = 2*(int(texture_height) - 1) - y2;
				x2 = int(texture_width) - 1 - x2;
			}
			float px = float(x2)/(texture_width - 1.0);
			float py = float(y2)/(texture_height - 1.0);
			if(x2 == 0){
				xpixels[j] = texture2D_yuv(vec2(0.0, py), 0);
				xpixels[j] += texture2D_yuv(vec2(0.0, 1.0 - py), 0);
				xpixels[j] /= 2.0;
			}else if(x2 == int(texture_width) - 1){
				xpixels[j] = texture2D_yuv(vec2(1.0, py), 0);
				xpixels[j] += texture2D_yuv(vec2(1.0, 1.0 - py), 0);
				xpixels[j] /= 2.0;
			}else if(y2 == 0){
				xpixels[j] = texture2D_yuv(vec2(px, 0.0), 0);
				xpixels[j] += texture2D_yuv(vec2(1.0 - px, 0.0), 0);
				xpixels[j] /= 2.0;
			}else if(y2 == int(texture_height) - 1){
				xpixels[j] = texture2D_yuv(vec2(px, 1.0), 0);
				xpixels[j] += texture2D_yuv(vec2(1.0 - px, 1.0), 0);
				xpixels[j] /= 2.0;
			}else{
				xpixels[j] = texture2D_yuv(vec2(px, py), 0);
			}
		}
		ypixels[i] = cubic_interpolation(_x, BICUBIC_A, xpixels);
	}
	return cubic_interpolation(_y, BICUBIC_A, ypixels);
	
//	vec2 p0 = vec2(iuv.x + 0.0, iuv.y + 0.0) / res;
//	vec2 p1 = vec2(iuv.x + 0.0, iuv.y + 1.0) / res;
//	vec2 p2 = vec2(iuv.x + 1.0, iuv.y + 0.0) / res;
//	vec2 p3 = vec2(iuv.x + 1.0, iuv.y + 1.0) / res;
//	
//	vec4 v1 = (1.0 - fuv.y) * texture2D_yuv(p0, 1) + fuv.y * texture2D_yuv(p1, 1);
//	vec4 v2 = (1.0 - fuv.y) * texture2D_yuv(p2, 1) + fuv.y * texture2D_yuv(p3, 1);
//    return (1.0 - fuv.x) * v1 + fuv.x * v2;

    

//    float g0x = g0(fuv.x);
//    float g1x = g1(fuv.x);
//    float h0x = h0(fuv.x);
//    float h1x = h1(fuv.x);
//    float h0y = h0(fuv.y);
//    float h1y = h1(fuv.y);
//
//	vec2 p0 = (vec2(iuv.x + h0x, iuv.y + h0y) - of) / res;
//	vec2 p1 = (vec2(iuv.x + h1x, iuv.y + h0y) - of) / res;
//	vec2 p2 = (vec2(iuv.x + h0x, iuv.y + h1y) - of) / res;
//	vec2 p3 = (vec2(iuv.x + h1x, iuv.y + h1y) - of) / res;
//	
//    return g0(fuv.y) * (g0x * texture2D_yuv(p0, 1)  +
//                        g1x * texture2D_yuv(p1, 1)) +
//           g1(fuv.y) * (g0x * texture2D_yuv(p2, 1)  +
//                        g1x * texture2D_yuv(p3, 1));
}

vec4 texture2D_bicubic(vec2 uv)
{
	vec2 res = vec2(texture_width - 1.0, texture_height - 1.0);
	
	uv = uv*res + of;
	vec2 iuv = floor( uv );
	vec2 fuv = fract( uv );

    float g0x = g0(fuv.x);
    float g1x = g1(fuv.x);
    float h0x = h0(fuv.x);
    float h1x = h1(fuv.x);
    float h0y = h0(fuv.y);
    float h1y = h1(fuv.y);

    vec2 p0 = (vec2(iuv.x + h0x, iuv.y + h0y) - of) / res;
	vec2 p1 = (vec2(iuv.x + h1x, iuv.y + h0y) - of) / res;
	vec2 p2 = (vec2(iuv.x + h0x, iuv.y + h1y) - of) / res;
	vec2 p3 = (vec2(iuv.x + h1x, iuv.y + h1y) - of) / res;
	
    return g0(fuv.y) * (g0x * texture2D_yuv(p0, 0)  +
                        g1x * texture2D_yuv(p1, 0)) +
           g1(fuv.y) * (g0x * texture2D_yuv(p2, 0)  +
                        g1x * texture2D_yuv(p3, 0));
}

void main(void) {	
	//gl_FragColor = texture2D_yuv(_tcoord);
	if(boundary >= 1.0){
		//gl_FragColor = texture2D_bicubic(tcoord);
		gl_FragColor = texture2D_border(tcoord);
		//gl_FragColor = vec4(0.0,0.0,0.0,1.0);
	}else if(resolution == 1.0){
		gl_FragColor = texture2D_yuv(tcoord, 0);
	}else{
		//gl_FragColor = texture2D_border(tcoord);
		gl_FragColor = texture2D_bicubic(tcoord);
	}
}
