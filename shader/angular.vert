//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;
//angular map params
//coner pitch PI : angular_r = M_SQRT_2 && angular_gain = M_PI / asin(1.0 / angular_r) 
//mirror-ball : angular_r = 1.0 && angular_gain = M_PI / asin(1.0 / angular_r) 
//axsis edge fov_rad : angular_r = 1.0 && angular_gain = fov_rad / asin(1.0 / angular_r) 
uniform float angular_gain;
uniform float angular_r;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

varying vec2 tcoord;

void main(void) {
	float x = position.x / position.z;
	float y = position.y / position.z;
	gl_Position = vec4(x * frame_scalex, y * frame_scaley, 1.0, 1.0);

	vec4 pos = unif_matrix * vec4(position, 1.0);

	float pitch = acos(pos.z);
	float roll = atan(pos.y, pos.x);
	float _pitch = pitch / angular_gain;
	float r = (_pitch > M_PI / 2.0) ? angular_r : sin(_pitch) * angular_r;
	//pitch = angular_gain * asin(r / angular_r) ;

	float tex_x = r * cos(roll); //[-1:1]
	float tex_y = r * sin(roll); //[-1:1]
	tcoord = (vec2(tex_x, tex_y) + vec2(1, 1)) * vec2(0.5, 0.5);
}
