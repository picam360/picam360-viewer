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
		var options = {
			frequency : 1000 / 100
		}; // 100fps

		var watchID_attitude = navigator.devicemotion
			.watchAttitude(app.onSuccess_attitude, app.onError_attitude, options);
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
		lat = Math.round(Math.atan2(-acceleration.z, -acceleration.x) * 180
			/ Math.PI);
		if (lat < -90) {
			lat = -180 - lat;
		}
		if (lat > 90) {
			lat = 180 - lat;
		}
	},

	onError_accel : function() {
		console.log('onError!');
	},

	// onSuccess: Get the current heading
	onSuccess_compass : function(heading) {
		// console.log('Heading: ' + heading.magneticHeading);
		lon = heading.magneticHeading;
	},

	// onError: Failed to get the heading
	onError_compass : function(compassError) {
		alert('Compass Error: ' + compassError.code);
	},

	// Update DOM on a Received Event
	receivedEvent : function(id) {
		console.log('Received Event: ' + id);
	},

	main : function() {
		app.receivedEvent('main');
		function GetQueryString()
		{
	    	var result = {};
		    if( 1 < window.location.search.length )
		    {
		        var query = window.location.search.substring( 1 );
		        var parameters = query.split( '&' );
		
		        for( var i = 0; i < parameters.length; i++ )
		        {
		            var element = parameters[ i ].split( '=' );
		
		            var paramName = decodeURIComponent( element[ 0 ] );
		            var paramValue = decodeURIComponent( element[ 1 ] );

		            result[ paramName ] = paramValue;
		        }
		    }
		    return result;
		}
		var query = GetQueryString();
		var server_url = window.location.href.split('?')[0];
		if(query['server_url']){
			server_url = query['server_url'];
		}
		var rtp;
		var mjpeg_decoder;
		jQuery.getScript(server_url + 'socket.io/socket.io.js', function() {
			// connect websocket
			socket = io.connect(server_url);

			// set decoder target
			var img = new Image();
			img.onload = function() {
				var canvas = document.getElementById('vrCanvas');
				var ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0);
			};
			mjpeg_decoder = MjpegDecoder(img);

			// set rtp callback
			rtp = Rtp();
			rtp.set_callback(socket, function(packet) {
				if (packet.GetPayloadType() == 110) {// image
					mjpeg_decoder.decode(packet.GetPayload(), packet
						.GetPayloadLength());
				}
			});
		});
	}
};

app.receivedEvent('test');
app.initialize();