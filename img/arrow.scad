//arrow

//export as amf file
//insert color after id tag
//<color><r>1.0</r><g>1.0</g><b>0.0</b><a>0.5</a></color>

module arrow(){
    cylinder(r1=10, r2=0, h=20, $fn=3);
}
color([0.5,0.5,0.5,0.75])
rotate([90,30,0])
arrow();