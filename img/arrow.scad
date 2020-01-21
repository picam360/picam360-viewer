//arrow

//export as amf file
//insert color after id tag
//<color><r>1.0</r><g>1.0</g><b>0.0</b><a>0.5</a></color>

module arrow(){
    intersection(){
        difference(){
            cylinder(r=10, h=0.1, $fn=3);
            translate([-6,0,0])
            cylinder(r=10, h=100, $fn=3,center=true);
        }
        cube([20,10,10],center=true);
    }
}
translate([0,10,0])
color([0.5,0.5,0.5,0.75])
rotate([0,0,-90])
arrow();

//translate([0,20,0])
//color([0.5,0.5,0.5,0.75])
//rotate([0,0,-90])
//arrow();
//
//translate([0,30,0])
//color([0.5,0.5,0.5,0.75])
//rotate([0,0,-90])
//arrow();

translate([-3/2,3,0])
color([0.5,0.5,0.5,0.75])
cube([3,20,0.1]);