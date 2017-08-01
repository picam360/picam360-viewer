//THREE.PlaneGeometry(2, 2)
//position is x:[-1,1], y:[-1,1]
varying vec2 tcoord;
uniform float tex_scalex;
uniform float tex_scaley;
void main() {
	gl_Position = vec4(position, 1.0);
	tcoord = (vec2(position.x * tex_scalex, position.y * tex_scaley)
			+ vec2(1, 1)) * vec2(0.5, 0.5);
}
