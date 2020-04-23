//position is windowed sphere
const int STEPNUM = 32;

uniform float eye_offset;
uniform float edge_r;
uniform float gain_r;
uniform float gain_theta;
uniform float frame_scalex;
uniform float frame_scaley;
uniform float texture_width;
uniform float texture_height;
//angular map params
uniform float r_table[STEPNUM];
uniform float pitch_table[STEPNUM];
//vr_mode
uniform bool vr_mode;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;
const float M_PI_DIV_2 = M_PI / 2.0;
const float M_PI_DIV_4 = M_PI / 4.0;
const float M_SQRT_2 = 1.4142135623;

varying vec2 tcoord;
varying float resolution;
varying float boundary;

float get_y(float x, float x_table[STEPNUM], float y_table[STEPNUM]) {
	%GET_Y%
}

void main(void) {
	float x = position.x;
	float y = position.y;
	float z = position.z;
	float material_index = sqrt(x * x + y * y + z * z);
	x /= material_index;
	y /= material_index;
	z /= material_index;
	material_index = floor(material_index - 0.5);
	float pitch = acos(z);
	float roll = atan(y, x);
	float r = get_y(pitch, pitch_table, r_table);
	float edge_r_s = 1.0 - edge_r;
	float edge_r_e = sqrt(1.0*1.0 + edge_r*edge_r);
	if (r > edge_r_s) {
		float roll_base;
		if (material_index == 0.0) {
			roll_base = M_PI_DIV_4;
		} else if (material_index == 1.0) {
			roll_base = M_PI_DIV_2 + M_PI_DIV_4;
			if (roll < 0.0) {
				roll = roll + 2.0 * M_PI;
			}
		} else if (material_index == 2.0) {
			roll_base = -M_PI_DIV_2 - M_PI_DIV_4;
			if (roll > 0.0) {
				roll = roll - 2.0 * M_PI;
			}
		} else if (material_index == 3.0) {
			roll_base = -M_PI_DIV_4;
		} else {
			roll_base = -M_PI_DIV_4;
		}
		float roll_diff = roll - roll_base;
		
		if(gain_theta != 0.0){
			float blend = 1.0;
			if(r < 1.0){
				blend = (r - edge_r_s)/(1.0 - edge_r_s);
			}
			if(abs(roll_diff) < M_PI_DIV_4){
				roll_diff = (1.0 - pow(1.0 - abs(roll_diff)/M_PI_DIV_4, 1.0/(1.0 + gain_theta*blend)))*M_PI_DIV_4*(roll_diff>0.0?1.0:-1.0);
			}
		}
		if(gain_r != 0.0){
			float gain_r1 = floor(gain_r);
			float gain_r2 = gain_r - gain_r1;
			float roll_diff_ratio = pow(abs(roll_diff)/M_PI_DIV_4, gain_r1);
			r = pow((r-edge_r_s)/(M_SQRT_2-edge_r_s), 1.0/(1.0 + gain_r2*roll_diff_ratio))*(M_SQRT_2-edge_r_s) + edge_r_s;
		}
		
		float protrusion;
		if(r < edge_r_e) {
			float ox = 1.0 - edge_r;
			float oy = edge_r;
			float a = -ox / oy;
			float b = (ox*ox + r*r) / (2.0*oy);
			float x_edge = (-a*b + sqrt(r*r * (1.0 + a*a) - b*b)) / (1.0 + a*a);
			if(x_edge >= r){
				protrusion = 0.0;
			}else{
				protrusion = acos(x_edge / r);
			}
		} else {
			protrusion = acos(1.0 / r);
		}
		float roll_gain = (M_PI - 4.0 * protrusion) / M_PI;
		roll_diff *= roll_gain;
		if(abs(roll_diff) > M_PI_DIV_4){
			roll_diff = roll_diff > 0.0 ? M_PI_DIV_4 : -M_PI_DIV_4;
		}
		roll = roll_diff + roll_base;
	}

	if (z == 1.0) {
		roll = 0.0;
	}
	float tex_x = r * cos(roll); //[-1:1]
	float tex_y = r * sin(roll); //[-1:1]
	tcoord = (vec2(tex_x, tex_y) + vec2(1, 1)) * vec2(0.5, 0.5);
	if(r > 0.8){//only for p2v(pixel to vector)
		vec2 iuv = floor(tcoord * vec2(texture_width - 1.0, texture_height - 1.0)+0.5);
		tcoord.x = iuv.x/(texture_width - 1.0);
		tcoord.y = iuv.y/(texture_height - 1.0);
		if (iuv.x <= 1.0 || iuv.y <= 1.0
		 || iuv.x >= texture_width - 2.0 || iuv.y >= texture_height - 2.0) {
			boundary = 1.0;
		}else{
			boundary = 0.0;
		}
	} else{
		boundary = 0.0;
	}
//	if (tcoord.x < 0.0) {
//		tcoord.x = 0.0;
//	} else if (tcoord.x > 1.0) {
//		tcoord.x = 1.0;
//	}
//	if (tcoord.y < 0.0) {
//		tcoord.y = 0.0;
//	} else if (tcoord.y > 1.0) {
//		tcoord.y = 1.0;
//	}

	vec4 pos = unif_matrix * vec4(x, y, z, 1.0);
	pos /= sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
	if (pos.z > 0.0) {
		float x = (pos.x / pos.z);
		float y = (pos.y / pos.z);
		gl_Position = vec4(x * frame_scalex + eye_offset, y * frame_scaley, 1.0, 1.0);
		//if(vr_mode){
		//	//lens distortion will be done on webvr mode in system
		//	//lens distortion
		//	//float r = sqrt(x*x + y*y);
		//	//float theta = atan(tan(M_PI * 60.0 / 180.0 / 2.0)*r)*0.2;
		//	//float r_ratio = sin(theta) / r / sin(M_PI / 2.0 * 0.2) * 3.5;
		//	//x *= r_ratio;
		//	//y *= r_ratio;
		//	gl_Position = vec4(x * frame_scalex + eye_offset, y * frame_scaley, 1.0, 1.0);
		//}
	} else {
		gl_Position = vec4(0, 0, 2.0, 1.0);
	}
	
	if(r < 0.5){
		resolution = 1.0;
	}else{
		resolution = 0.0;
	}
}
