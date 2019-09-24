//position is windowed sphere
const int STEPNUM = 32;

uniform float eye_offset;
uniform float frame_scalex;
uniform float frame_scaley;
uniform float pixel_size_x;
uniform float pixel_size_y;
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

const float FXAA_SUBPIX_SHIFT = 1.0/4.0;

varying vec2 tcoord;
varying vec2 tcoord2;

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
	if (r > 1.0) {
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
		float roll_gain = (M_PI - 4.0 * acos(1.0 / r)) / M_PI;
		roll = roll_diff * roll_gain + roll_base;
	}

	if (z == 1.0) {
		roll = 0.0;
	}
	float tex_x = r * cos(roll); //[-1:1]
	float tex_y = r * sin(roll); //[-1:1]
	tcoord = (vec2(tex_x, tex_y) + vec2(1, 1)) * vec2(0.5, 0.5);
	tcoord.y = (tcoord.y - 0.5) * (1.0 - pixel_size_y) + 0.5;
	tcoord.x = (tcoord.x - 0.5) * (1.0 - pixel_size_y) + 0.5;
	if (tcoord.x < 0.0) {
		tcoord.x = 0.0;
	} else if (tcoord.x > 1.0) {
		tcoord.x = 1.0;
	}
	if (tcoord.y < 0.0) {
		tcoord.y = 0.0;
	} else if (tcoord.y > 1.0) {
		tcoord.y = 1.0;
	}
	vec2 rcpFrame = vec2(pixel_size_x, pixel_size_y);
	tcoord2.xy = tcoord.xy - (rcpFrame * (0.5 + FXAA_SUBPIX_SHIFT));

	vec4 pos = unif_matrix * vec4(x, y, z, 1.0);
	if (pos.z > 0.0) {
		float x = (pos.x / pos.z);
		float y = (pos.y / pos.z);
		gl_Position = vec4(x * frame_scalex, y * frame_scaley, 1.0, 1.0);
		//lens distortion
		if(vr_mode){
			float r = sqrt(x*x + y*y);
			float theta = atan(tan(M_PI * 60.0 / 180.0 / 2.0)*r)*0.2;
			float r_ratio = sin(theta) / r / sin(M_PI / 2.0 * 0.2) * 3.5;
			x *= r_ratio;
			y *= r_ratio;
			gl_Position = vec4(x * frame_scalex + eye_offset, y * frame_scaley, 1.0, 1.0);
		}
	} else {
		gl_Position = vec4(0, 0, 2.0, 1.0);
	}
}
