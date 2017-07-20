//THREE.PlaneGeometry(2, 2)
//position is x:[-1,1], y:[-1,1]
varying vec2 tcoord;
void main() {
	tcoord = (position.xy + vec2(1, 1)) * vec2(0.5, 0.5);
	gl_Position = vec4(position, 1.0);
}
