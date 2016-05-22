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
var app = {
	// Application Constructor
	initialize : function() {
		app.receivedEvent('initialize');
		this.bindEvents();

		//window.addEventListener("orientationchange", function() {
		//	alert(window.orientation);
		//});
		
		window.addEventListener('deviceorientation', function(attitude){
			if(attitude['detail']) {
				attitude = attitude['detail'];
			}
			if(attitude.alpha != null) {
				var roll = 0;
				var pitch = 0;
				var yaw = 0;
				switch(window.orientation){
				case 0:
					var quat_correct = new THREE.Quaternion().setFromEuler(
						new THREE.Euler(
							THREE.Math.degToRad(0), 
							THREE.Math.degToRad(0), 
							THREE.Math.degToRad(90),
						"ZYX"));
					var quaternion = new THREE.Quaternion().setFromEuler(
						new THREE.Euler(
							THREE.Math.degToRad(attitude.gamma),
							THREE.Math.degToRad(attitude.beta),
							THREE.Math.degToRad(-attitude.webkitCompassHeading),
						"ZYX"));
					quaternion.multiply(quat_correct);
					var euler = new THREE.Euler().setFromQuaternion(quaternion, "ZYX");
					roll = THREE.Math.radToDeg(euler.x);
					pitch = THREE.Math.radToDeg(euler.y);
					//yaw = THREE.Math.radToDeg(euler.z);//unstable, attitude.alpha is also unstable
					yaw = -attitude.webkitCompassHeading;
					break;
				case 90:
					roll = -attitude.gamma;
					pitch = -attitude.beta;
					yaw = attitude.alpha + 180;
					break;
				case -90:
					roll = attitude.gamma;
					pitch = attitude.beta;
					yaw = attitude.alpha;
					break;
				default:
					return;
				}
				omvc.setMyAttitude({
					Roll : roll,
					Pitch : pitch,
					Yaw : yaw,
					Timestamp : 0
				});
			}
		});
		window.addEventListener('message', function(event){
			var args = JSON.parse(event.data);
			if(!args['function']){
				alert("no handler : null");
				return;
			}
			switch(args['function']){
			case 'dispatchEvent':
				var event = new CustomEvent(args['event_name'], {'detail' : JSON.parse(args['event_data'])});
				window.dispatchEvent(event);
				break;
			default:
				alert("no handler : "+args['function']);
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
		// socket = io.connect('http://192.168.254.1:8080');
		// socket.on('connect', function() {
		// console.log('connect!!');
		// });
		var options = {
			frequency : 1000 / 100
		}; // 100fps
		// var watchID_accel =
		// navigator.accelerometer.watchAcceleration(app.onSuccess_accel,
		// app.onError_accel, options);
		// var watchID_compass =
		// navigator.compass.watchHeading(app.onSuccess_compass,
		// app.onError_compass, options);

		var watchID_attitude = navigator.devicemotion.watchAttitude(app.onSuccess_attitude, app.onError_attitude, options);
	},

	onSuccess_attitude : function(attitude) {
		omvc.setMyAttitude({
			Roll : attitude.alpha,
			Pitch : attitude.beta,
			Yaw : attitude.gamma,
			Timestamp : attitude.timestamp
		});
	},

	onError_attitude : function(error) {
		alert('Sensor error: ' + error);
	},

	onSuccess_accel : function(acceleration) {
		// console.log('Acceleration X: ' + acceleration.x + '\n' +
		// 'Acceleration Y: ' + acceleration.y + '\n' + 'Acceleration Z: ' +
		// acceleration.z + '\n' + 'Timestamp: ' + acceleration.timestamp
		// + '\n');
		lat = Math.round(Math.atan2(-acceleration.z, -acceleration.x) * 180 / Math.PI);
		if (lat < -90) {
			lat = -180 - lat;
		}
		if (lat > 90) {
			lat = 180 - lat;
		}
		// console.log(lat);
		// set_lon(theta);
		// if (theta != tilt) {
		// tilt = theta;
		// socket.emit('tilt_update', tilt / 90);
		// }
	},

	onError_accel : function() {
		console.log('onError!');
	},

	// onSuccess: Get the current heading
	//
	onSuccess_compass : function(heading) {
		// console.log('Heading: ' + heading.magneticHeading);
		lon = heading.magneticHeading;
	},

	// onError: Failed to get the heading
	//
	onError_compass : function(compassError) {
		alert('Compass Error: ' + compassError.code);
	},

	// Update DOM on a Received Event
	receivedEvent : function(id) {
		console.log('Received Event: ' + id);
	}
};

app.receivedEvent('test');
app.initialize();