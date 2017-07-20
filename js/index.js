/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var tilt = 0;
var socket;
var fov = 120;
var mpu;

var viewOffset = {
	Pitch : 0,
	Yaw : 0,
	Roll : 0,
};
var myAttitude = {
	Pitch : 0,
	Yaw : 0,
	Roll : 0,
};
var app = {
	isDeviceReady : false,
	// Application Constructor
	initialize : function() {
		app.receivedEvent('initialize');
		this.bindEvents();

		// window.addEventListener("orientationchange", function() {
		// alert(window.orientation);
		// });

		window.addEventListener('message', function(event) {
			var args = JSON.parse(event.data);
			if (!args['function']) {
				alert("no handler : null");
				return;
			}
			switch (args['function']) {
				case 'dispatchEvent' :
					var event = new CustomEvent(args['event_name'], {
						'detail' : JSON.parse(args['event_data'])
					});
					window.dispatchEvent(event);
					break;
				default :
					alert("no handler : " + args['function']);
			}
		});
	},
	// Bind Event Listeners
	//
	// Bind any events that are required on startup. Common events are:
	// 'load', 'deviceready', 'offline', and 'online'.
	bindEvents : function() {
		document.addEventListener('deviceready', this.onDeviceReady, false);
	},
	// deviceready Event Handler
	//
	// The scope of 'this' is the event. In order to call the 'receivedEvent'
	// function, we must explicitly call 'app.receivedEvent(...);'
	onDeviceReady : function() {
		app.receivedEvent('deviceready');
		app.isDeviceReady = true;
	},

	// Update DOM on a Received Event
	receivedEvent : function(id) {
		console.log('Received Event: ' + id);
	},

	initMouseEventLisener : function() {
		var down = false;
		var swipeable = false;
		var sx = 0, sy = 0;
		var mousedownFunc = function(ev) {
			if(ev.type == "touchstart") {
				ev.clientX = ev.pageX;
				ev.clientY = ev.pageY;
			}
			down = true;
			sx = ev.clientX;
			sy = ev.clientY;
			swipeable = (sx < 50);
			menu.setSwipeable(swipeable);
		};
		var mousemoveFunc = function(ev) {
			if(ev.type == "touchmove") {
				ev.clientX = ev.pageX;
				ev.clientY = ev.pageY;
				ev.button = 0;
			}
			if (!down || swipeable || ev.button != 0) {
				return;
			}
			var dx = -(ev.clientX - sx);
			var dy = -(ev.clientY - sy);
			sx -= dx;
			sy -= dy;

			var roll_diff = dx * fov / 300;
			var pitch_diff = -dy * fov / 300;
			
			var view_offset_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.Math.degToRad(viewOffset.Pitch), THREE.Math.degToRad(viewOffset.Yaw), THREE.Math.degToRad(viewOffset.Roll), "ZXY"));
			var view_offset_diff_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.Math.degToRad(pitch_diff), THREE.Math.degToRad(0), THREE.Math.degToRad(roll_diff), "ZXY"));
			var view_quat = 
				new THREE.Quaternion().setFromEuler(
					new THREE.Euler(
						THREE.Math.degToRad(myAttitude.Pitch),
						THREE.Math.degToRad(myAttitude.Yaw),
						THREE.Math.degToRad(myAttitude.Roll),
					"ZXY"));
			var view_inv_quat = view_quat.clone().conjugate();
			view_offset_quat = view_inv_quat.multiply(view_offset_diff_quat).multiply(view_quat).multiply(view_offset_quat); // (RvoRv)Rvd(RvoRv)^-1RvoRvRv^-1
			var euler = new THREE.Euler().setFromQuaternion(view_offset_quat, "ZXY");
			viewOffset = {
				Pitch : THREE.Math.radToDeg(euler.x),
				Yaw : THREE.Math.radToDeg(euler.y),
				Roll : THREE.Math.radToDeg(euler.z),
			};
			console.log(viewOffset);
			
			mpu.set_attitude(viewOffset.Pitch, viewOffset.Yaw, viewOffset.Roll);

			autoscroll = false;
		}
		var mouseupFunc = function() {
			down = false;
		};
		document.addEventListener("touchstart", mousedownFunc);
		document.addEventListener("touchmove", mousemoveFunc);
		document.addEventListener("touchend", mouseupFunc);
		document.addEventListener("mousedown", mousedownFunc);
		document.addEventListener("mousemove", mousemoveFunc);
		document.addEventListener("mouseup", mouseupFunc);			
		
		var _fov = 70;
		function gestureStartHandler(e) {
			_fov = fov;
		}
		
		function gestureChangeHandler(e) {
			fov = _fov / e.scale;
			if(fov > 150) {
				fov = 150;
			} else if(fov < 30) {
				fov = 30;
			}
			self.omvr.setFov(fov);
			socket.emit('setFov', fov);
		}
		
		function gestureEndHandler(e) {
		}
		
		if ("ongesturestart" in window) {
			document.addEventListener("gesturestart", gestureStartHandler, false);
			document.addEventListener("gesturechange", gestureChangeHandler, false);
			document.addEventListener("gestureend", gestureEndHandler, false);
		}
	},

	cmd_list : [],
	send_command : function(cmd) {
		app.cmd_list.push(cmd);
	},
	rtcp_command_id : 0,

	main : function() {
		app.receivedEvent('main');
		function GetQueryString() {
			var result = {};
			if (1 < window.location.search.length) {
				var query = window.location.search.substring(1);
				var parameters = query.split('&');

				for (var i = 0; i < parameters.length; i++) {
					var element = parameters[i].split('=');

					var paramName = decodeURIComponent(element[0]);
					var paramValue = decodeURIComponent(element[1]);

					result[paramName] = paramValue;
				}
			}
			return result;
		}
		var query = GetQueryString();
		var server_url = window.location.href.split('?')[0];
		if (query['server_url']) {
			server_url = query['server_url'];
		}
		// main canvas
		var canvas = document.getElementById('vrCanvas');
		// webgl handling
		var omvr = OMVR();
		// data stream handling
		var rtp = Rtp();
		var rtcp = Rtcp();
		// video decoder
		var mjpeg_decoder = MjpegDecoder();
		// motion processer unit
		//var mpu = MPU();
		mpu = MPU();
		
		app.initMouseEventLisener();

		// init viewer
		omvr.init(canvas);

		// set decoder target
		textures = [new Image(), new Image(), new Image()];

		for ( var i in textures) {
			var pre = (i == 0) ? textures.length - 1 : parseInt(i) - 1;
			var next = (i == textures.length - 1) ? 0 : parseInt(i) + 1;
			textures[i].pre = textures[pre];
			textures[i].next = textures[next];
		}
		textures.forEach(function(texture) {
			texture.onload = function() {
				omvr.setTextureImg(texture.pre);
				mjpeg_decoder.set_target_texture(texture.next);
			}
		});
		mjpeg_decoder.set_target_texture(textures[0]);

		// init mpu
		mpu.init();

		// init network related matters
		jQuery.getScript(server_url + 'socket.io/socket.io.js', function() {
			// connect websocket
			socket = io.connect(server_url);

			// set rtp callback
			rtp.set_callback(socket, function(packet, cmd_request) {
				if (packet.GetPayloadType() == 110) {// image
					mjpeg_decoder.decode(packet.GetPayload(), packet
						.GetPayloadLength());
					if (cmd_request) {
						var UPSTREAM_DOMAIN = "upstream.";
						var quat = mpu.get_quaternion();
						var cmd = UPSTREAM_DOMAIN + "set_view_quaternion 0="
							+ quat.x + "," + quat.y + "," + quat.z + ","
							+ quat.w;
						return cmd;
					}
				}
			});
			setInterval(function() {
				if (!app.cmd_list.length) {
					return;
				}
				var value = app.cmd_list.shift();
				var cmd = "<picam360:command id=\"" + app.rtcp_command_id
					+ "\" value=\"" + value + "\" />"
				rtcp.sendpacket(socket, cmd, 101);
				app.rtcp_command_id++;
			}, 10);// 100hz
		});

		{
			document.getElementById("overlay").style.display = "none";
			document.getElementById("infoTypeBox").style.display = "none";
			document.getElementById("debugMsgBox").style.display = "none";
			document.getElementById("actuatorMsgBox").style.display = "none";
			document.getElementById("attitudeMsgBox").style.display = "none";

			document.getElementById("movie_download_box").style.display = "none";
		}

		// poling loop
		function animate() {
			omvr.animate();
			requestAnimationFrame(animate);
		}
		requestAnimationFrame(animate);
	}
};

app.receivedEvent('load index.js');
app.initialize();