//position is windowed sphere
const int STEPNUM = 64;
const float STEPNUM_M1 = 63.0;

uniform float frame_scalex;
uniform float frame_scaley;
//angular map params
uniform float pitch_2_r[STEPNUM];

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;
const float M_PI_DIV_2 = M_PI / 2.0;
const float M_PI_DIV_4 = M_PI / 4.0;
const float M_SQRT_2 = 1.4142135623;

varying vec2 tcoord;

void main(void) {
	float x = position.x / position.z;
	float y = position.y / position.z;
	gl_Position = vec4(x * frame_scalex, y * frame_scaley, 1.0, 1.0);

	vec4 pos = unif_matrix * vec4(position, 1.0);

	float pitch = acos(pos.z);
	float roll = atan(pos.y, pos.x);
	
	float indexf = pitch / M_PI * STEPNUM_M1;
	int index = int(indexf);
	float index_sub = indexf - float(index);
	float r = pitch_2_r[index] * (1.0 - index_sub) + pitch_2_r[index + 1] * index_sub;
	if (r < M_SQRT_2 && r > 1.0) {
		int roll_index = int(roll / M_PI_DIV_2);
		float roll_base = float(roll_index) * M_PI_DIV_2 + (roll > 0.0 ? M_PI_DIV_4 : -M_PI_DIV_4);
		float roll_diff = roll - roll_base;
		float roll_gain = (M_PI - 4.0 * acos(1.0 / r)) / M_PI;
		roll = roll_diff * roll_gain + roll_base;
	}

	float tex_x = r * cos(roll); //[-1:1]
	float tex_y = r * sin(roll); //[-1:1]
	tcoord = (vec2(tex_x, tex_y) + vec2(1, 1)) * vec2(0.5, 0.5);
}
