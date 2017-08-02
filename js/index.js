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
var UPSTREAM_DOMAIN = "upstream.";

var app = (function() {
	var tilt = 0;
	var socket;
	var fov = 120;

	// main canvas
	var canvas;
	// webgl handling
	var omvr;
	// data stream handling
	var rtp;
	var rtcp;
	// video decoder
	var mjpeg_decoder;
	var h264_decoder;
	// motion processer unit
	var mpu;

	var options = {};
	var plugins = [];

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var cmd2upstream_list = [];

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback(req.responseText);
		}
	}

	var plugin_host = function(app) {
		function handle_command(cmd) {
			var split = cmd.split(' ');
			if (split[0] == "set_stereo") {
				omvr.setStereoEnabled(split[1] == "true" || split[1] == "1");
			}
		}
		var self = {
			send_command : function(cmd) {
				if (cmd.indexOf(UPSTREAM_DOMAIN) == 0) {
					cmd2upstream_list.push(cmd.substr(UPSTREAM_DOMAIN.length));
					return;
				}
				for (var i = 0; i < plugins.length; i++) {
					if (plugins[i].command_handler) {
						plugins[i].command_handler(cmd);
					}
				}
				handle_command(cmd);
			},
			send_event : function(sender, event) {
				for (var i = 0; i < plugins.length; i++) {
					if (plugins[i].event_handler) {
						plugins[i].event_handler(sender, event);
					}
				}
			},
			get_mpu : function() {
				return mpu;
			},
			get_fov : function() {
				return fov;
			},
			set_fov : function(value) {
				self
					.send_command(SYSTEM_DOMAIN + "set_fov 0=" + value.toFixed(0));
			},
		};
		return self;
	};
	var self = {
		plugin_host : plugin_host(self),
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
		// The scope of 'this' is the event. In order to call the
		// 'receivedEvent'
		// function, we must explicitly call 'app.receivedEvent(...);'
		onDeviceReady : function() {
			app.receivedEvent('deviceready');
			app.isDeviceReady = true;
		},

		// Update DOM on a Received Event
		receivedEvent : function(id) {
			console.log('Received Event: ' + id);
		},

		init_options : function(callback) {
			loadFile("config.json", function(txt) {
				options = JSON.parse(txt);
				if (options.plugin_paths && options.plugin_paths.length != 0) {
					function load_plugin(idx) {
						var script = document.createElement('script');
						script.onload = function() {
							console
								.log("loaded : " + options.plugin_paths[idx]);
							if (create_plugin) {
								var plugin = create_plugin(self.plugin_host);
								plugins.push(plugin);
								create_plugin = null;
							}
							if (idx + 1 < options.plugin_paths.length) {
								load_plugin(idx + 1);
							} else {
								for (var i = 0; i < plugins.length; i++) {
									if (plugins[i].init_options) {
										plugins[i].init_options(options);
									}
								}
								callback();
							}
						};
						console.log("loding : " + options.plugin_paths[idx]);
						script.src = options.plugin_paths[idx];

						document.head.appendChild(script);
					}
					load_plugin(0);
				} else {
					callback();
				}
			});
		},

		init_plugins : function() {
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

			self
				.init_options(function() {
					self.init_plugins();

					canvas = document.getElementById('vrCanvas');

					// webgl handling
					omvr = OMVR();
					omvr.init(canvas);

					// video decoder
					h264_decoder = H264Decoder();
					mjpeg_decoder = MjpegDecoder();
					h264_decoder.set_frame_callback(omvr.handle_frame);
					mjpeg_decoder.set_frame_callback(omvr.handle_frame);

					// motion processer unit
					mpu = MPU();
					mpu.init();

					// init network related matters
					// data stream handling
					rtp = Rtp();
					rtcp = Rtcp();
					jQuery
						.getScript(server_url + 'socket.io/socket.io.js', function() {
							// connect websocket
							socket = io.connect(server_url);

							socket
								.on("custom_error", function(event) {
									console.log("error : " + event);
									switch (event) {
										case "exceeded_num_of_clients" :
											alert("The number of clients is exceeded.");
											break;
									}
								});

							// set rtp callback
							rtp.set_callback(socket, function(packet,
								cmd_request) {
								if (packet.GetPayloadType() == 110) {// image
									mjpeg_decoder
										.decode(packet.GetPayload(), packet
											.GetPayloadLength());
									h264_decoder
										.decode(packet.GetPayload(), packet
											.GetPayloadLength());
									if (cmd_request) {
										var UPSTREAM_DOMAIN = "upstream.";
										var quat = mpu.get_quaternion();
										var cmd = UPSTREAM_DOMAIN
											+ "set_view_quaternion 0=" + quat.x
											+ "," + quat.y + "," + quat.z + ","
											+ quat.w;
										return cmd;
									}
								}
							});
							setInterval(function() {
								if (!cmd2upstream_list.length) {
									return;
								}
								var value = cmd2upstream_list.shift();
								var cmd = "<picam360:command id=\""
									+ app.rtcp_command_id + "\" value=\""
									+ value + "\" />"
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

					// animate
					self.start_animate();
				});
		},
		start_animate : function() {
			// //this technic is for split requestAnimationFrame chain to get
			// websocket performance
			// var altframe = true, frametime = 0, lastframe = Date.now();
			// function animate() {
			// frametime = Date.now() - lastframe;
			// lastframe = Date.now();
			//
			// omvr.animate();
			//
			// if (altframe) {
			// window.requestAnimationFrame(animate);
			// altframe = false;
			// } else {
			// setTimeout(animate, frametime);
			// altframe = true;
			// }
			// };
			// animate();

			// setInterval(function() {
			// omvr.animate();
			// }, 100);

			// // poling loop
			// omvr.animate();
			// requestAnimationFrame(animate);
			// }
		}
	};
	return self;
})();

app.receivedEvent('load index.js');
app.initialize();