//arrow

//export as amf file
//insert color after id tag
//<color><r>1.0</r><g>1.0</g><b>0.0</b><a>0.5</a></color>,

module arrow(){
    cylinder(r=10, h=10, $fn=3);
}
color([0.5,0.5,0.5,0.75])
arrow();