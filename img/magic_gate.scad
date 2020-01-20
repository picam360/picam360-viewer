//arrow

//export as amf file
//insert color after id tag
//<color><r>1.0</r><g>1.0</g><b>0.0</b><a>0.5</a></color>

module magic_circle(){
    for(i=[0,1]){
        rotate([0,0,60*i])
        difference(){
            cylinder(r=10, h=1, $fn=3, center=true);
            cylinder(r=9, h=100, $fn=3, center=true);
        }
    }
        difference(){
            cylinder(r=10, h=1, center=true);
            cylinder(r=9, h=100, center=true);
        }
}
color([0.5,0.5,0.5,0.75])
rotate([90,30,0])
magic_circle();