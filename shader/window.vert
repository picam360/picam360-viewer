//THREE.SphereGeometry()
//position is windowed sphere
uniform float frame_scalex;
uniform float frame_scaley;

uniform mat4 unif_matrix;

const float M_PI = 3.1415926535;

varying vec4 pos;
varying float tcoord_y;

void main(void) {
	gl_Position = vec4(position.x / position.z * frame_scalex, position.y / position.z * frame_scaley, 1.0, 1.0);

	pos = unif_matrix * vec4(position, 1.0);
	
	float pitch = asin(pos.y);
	tcoord_y = -pitch / M_PI + 0.5;
	
	//float yaw = atan(pos.x, pos.z);
	//tcoord_x = -yaw / (M_PI * 2.0) + 0.5;
}
