//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;
uniform float tex_aspect_ratio;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

uniform float cam_c[2];
uniform float cam_f[2];
uniform float lens_k[4];

varying vec3 cam_uvr;

void main(void) {
	gl_Position = vec4(position.x / position.z * frame_scalex, position.y / position.z * frame_scaley, 1.0, 1.0);

	vec4 pos = unif_matrix * vec4(position, 1.0);
	
	float pitch = asin(pos.y);
	float yaw = atan(pos.x, pos.z);

	float r = (M_PI / 2.0 - pitch) / M_PI;
	float r2 = sin(M_PI * 180.0 / 220.0 * r) / 2.0;
	cam_uvr[0] = 0.9 * r2 * cos(yaw) * tex_aspect_ratio + 0.5;
	cam_uvr[1] = 0.9 * r2 * sin(yaw) + 0.5;
	cam_uvr[2] = r;
}
