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
var SERVER_DOMAIN = UPSTREAM_DOMAIN;
var CAPTURE_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
var DRIVER_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
var PT_STATUS = 100;
var PT_CMD = 101;
var PT_CAM_BASE = 110;
var P2P_API_KEY = "v8df88o1y4zbmx6r";
var PUBLIC_VIEWER = "http://picam360.github.io/picam360-viewer/";

var app = (function() {
	var tilt = 0;
	var socket;
	var fov = 120;
	var auto_scroll = false;

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

	var server_url = window.location.href.split('?')[0];
	var options = {};
	var plugins = [];
	var watches = [];
	var statuses = [];
	var is_recording = false;
	var view_offset = new THREE.Quaternion();
	var is_p2p_upstream = false;
	var p2p_uuid = "";
	var peer_conn = null;
	var default_image_url = null;

	var SYSTEM_DOMAIN = UPSTREAM_DOMAIN + UPSTREAM_DOMAIN;
	var cmd2upstream_list = [];

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			if (req.status == 200) {
				callback(req.responseText);
			} else {
				callback(null);
			}
		}
	}

	function set_is_recording(value) {
		if (is_recording != value) {
			is_recording = value;
			if (is_recording) {
				document.getElementById('imgRec').src = "img/stop_record_icon.png";
			} else {
				document.getElementById('imgRec').src = "img/start_record_icon.png";
			}
		}
	}

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

	function execCopy(string) {
		var temp = document.createElement('textarea');

		temp.value = string;
		temp.selectionStart = 0;
		temp.selectionEnd = temp.value.length;

		var s = temp.style;
		s.position = 'fixed';
		s.left = '-100%';

		document.body.appendChild(temp);
		temp.focus();
		var result = document.execCommand('copy');
		temp.blur();
		document.body.removeChild(temp);
		return result;
	}

	function uuid() {
		var uuid = "", i, random;
		for (i = 0; i < 32; i++) {
			random = Math.random() * 16 | 0;

			if (i == 8 || i == 12 || i == 16 || i == 20) {
				uuid += "-"
			}
			uuid += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random))
				.toString(16);
		}
		return uuid;
	}

	// interface for plugin
	function PluginHost(core) {

		function downloadAsFile(fileName, url) {
			var a = document.createElement('a');
			a.download = fileName;
			a.href = url;
			// a.target = "_blank";
			a.click();
		};

		function handle_command(cmd) {
			var split = cmd.split(' ');
			if (split[0] == "set_stereo") {
				plugin_host.set_stereo(split[1] == "true" || split[1] == "1");
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
			add_watch : function(name, callback) {
				watches[name] = callback;
			},
			get_view_quaternion : function() {
				if (mpu) {
					return mpu.get_quaternion();
				} else {
					return new THREE.Quaternion();
				}
			},
			get_fov : function() {
				return fov;
			},
			set_fov : function(value) {
				self.send_command(SYSTEM_DOMAIN + "set_fov 0="
					+ value.toFixed(0));
			},
			set_stereo : function(value) {
				omvr.setStereoEnabled(value);
			},
			set_view_offset : function(value) {
				view_offset = value;
				auto_scroll = false;
			},
			get_view_offset : function() {
				return view_offset.clone();
			},
			snap : function() {
				socket.emit('snap', function(filename) {
					console.log("save image!: " + filename);
					downloadAsFile('picam360.jpeg', server_url + "img/"
						+ filename);
				});
			},
			rec : function() {
				if (is_recording) {
					socket.emit('stop_record', function(filename) {
						console.log("save video!: " + filename);
						downloadAsFile('picam360.mp4', server_url + "img/"
							+ filename);
					});
				} else {
					socket.emit('start_record', function() {
						console.log("start_record");
					});
				}
			},
			p2p : function(bln) {
				if (bln) {
					core.start_p2p();
				} else {
					core.stop_p2p();
				}
			},
			call : function(bln) {
				if (bln) {
					core.start_call();
				} else {
					core.stop_call();
				}
			},
		};
		return self;
	};
	var self = {
		plugin_host : null,
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
				if (txt) {
					options = JSON.parse(txt);
				}
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

			document.getElementById("uiCall").style.display = "none";

			var query = GetQueryString();
			if (query['server-url']) {
				server_url = query['server-url'];
			}
			if (query['default-image-url']) {
				default_image_url = query['default-image-url'];
			}
			if (query['view-offset']) {
				var split = query['view-offset'].split(',');
				var euler = new THREE.Euler(THREE.Math
					.degToRad(parseFloat(split[0])), THREE.Math
					.degToRad(parseFloat(split[1])), THREE.Math
					.degToRad(parseFloat(split[2])), "YXZ");

				view_offset = new THREE.Quaternion().setFromEuler(euler);
			}
			if (query['fov']) {
				fov = parseFloat(query['fov']);
			}
			if (query['auto-scroll']) {
				auto_scroll = query['auto-scroll'] == "yes"
					|| query['auto-scroll'] == "on";
			}

			self.plugin_host = PluginHost(self);

			self
				.init_options(function() {
					self.init_plugins();

					canvas = document.getElementById('vrCanvas');

					self.plugin_host
						.add_watch("upstream.is_recording", function(value) {
							set_is_recording(value.toLowerCase() == 'true');
						});

					// webgl handling
					omvr = OMVR();
					omvr.init(canvas);
					omvr.setFov(fov);

					setInterval(function() {
						var quat = self.plugin_host.get_view_quaternion()
							|| new THREE.Quaternion();
						var view_offset_quat = self.plugin_host
							.get_view_offset();
						var view_quat = view_offset_quat.multiply(quat);
						omvr.setCameraQuaternion(view_quat);
						if (auto_scroll) {
							var view_offset_diff_quat = new THREE.Quaternion()
								.setFromEuler(new THREE.Euler(THREE.Math
									.degToRad(0), THREE.Math.degToRad(0), THREE.Math
									.degToRad(0.5), "YXZ"));
							view_offset = view_quat
								.multiply(view_offset_diff_quat).multiply(quat
									.conjugate());
						}
					}, 33);// 30hz

					if (default_image_url) {
						omvr
							.setSphere(default_image_url, "", "", "", false, false, null, {
								Pitch : 0,
								Yaw : 0,
								Roll : 0
							});
					}

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
					// set rtp callback
					rtp
						.set_callback(function(packet, cmd_request) {
							if (packet.GetPayloadType() == PT_CAM_BASE) {// image
								mjpeg_decoder
									.decode(packet.GetPayload(), packet
										.GetPayloadLength());
								h264_decoder.decode(packet.GetPayload(), packet
									.GetPayloadLength());
								if (cmd_request) {
									var quat = mpu.get_quaternion();
									quat = self.plugin_host.get_view_offset()
										.multiply(quat);
									var cmd = UPSTREAM_DOMAIN
										+ "set_view_quaternion 0=" + quat.x
										+ "," + quat.y + "," + quat.z + ","
										+ quat.w;
									return cmd;
								}
							} else if (packet.GetPayloadType() == PT_STATUS) {// status
								var str = String.fromCharCode
									.apply("", new Uint8Array(packet
										.GetPayload()));
								var split = str.split('"');
								var name = UPSTREAM_DOMAIN + split[1];
								var value = split[3];
								if (watches[name]) {
									watches[name](value);
								}
							}
						});
					// command to upstream
					setInterval(function() {
						if (!cmd2upstream_list.length) {
							return;
						}
						var value = cmd2upstream_list.shift();
						var cmd = "<picam360:command id=\""
							+ app.rtcp_command_id + "\" value=\"" + value
							+ "\" />"
						rtcp.sendpacket(rtcp.buildpacket(cmd, 101));
						app.rtcp_command_id++;
					}, 10);// 100hz

					// websocket
					jQuery
						.getScript(server_url + 'socket.io/socket.io.js', function() {
							// connect websocket
							socket = io.connect(server_url);

							socket.on("connect", function() {
								console.log("connected : " + socket.id);

								rtp.set_websocket(socket);
								rtcp.set_websocket(socket);

								is_p2p_upstream = true;
							});
							socket.on("disconnect", function() {
								console.log("disconnected");
							});
							socket
								.on("custom_error", function(event) {
									console.log("error : " + event);
									switch (event) {
										case "exceeded_num_of_clients" :
											alert("The number of clients is exceeded.");
											break;
									}
								});
						});

					// animate
					self.start_animate();
				});
		},
		start_p2p : function() {
			if (is_p2p_upstream) {
				var query = GetQueryString();
				if (query['p2p-uuid']) {
					p2p_uuid = query['p2p-uuid'];
				} else {
					p2p_uuid = uuid();
				}
				var viewer_url = PUBLIC_VIEWER + "?p2p-uuid=" + p2p_uuid;
				execCopy(viewer_url);
				alert("The p2p link was copied to clip board : " + viewer_url);
				var peer = new Peer(p2p_uuid, {
					key : P2P_API_KEY
				});
				peer.on('connection', function(conn) {
					peer_conn = conn;
					console.log("p2p connection established as upstream.");
					peer_conn.on('data', function(data) {
						// rtcp.sendpacket(data);
					});
					rtp
						.set_passthrough_callback(function(packets,
							rtp_callback) {
							peer_conn.send(packets);
						});
					navigator.getUserMedia = navigator.getUserMedia
						|| navigator.webkitGetUserMedia
						|| navigator.mozGetUserMedia;
					peer.on('call', function(call) {
						navigator.getUserMedia({
							video : false,
							audio : true
						}, function(stream) {
							call.answer(stream);
							call.on('stream', function(remoteStream) {
								var audio = $('<audio autoplay />')
									.appendTo('body');
								audio[0].src = (URL || webkitURL || mozURL)
									.createObjectURL(stream);
							});
						}, function(err) {
							console.log('Failed to get local stream', err);
						});
					});
				});
			} else {
				var peer = new Peer({
					key : P2P_API_KEY,
					debug : 1
				});
				var query = GetQueryString();
				if (query['p2p-uuid']) {
					p2p_uuid = query['p2p-uuid'];
				} else {
					p2p_uuid = window.prompt("Please input UUID.", "");
				}
				peer_conn = peer.connect(p2p_uuid, {
					constraints : {}
				});
				peer_conn.on('open', function() {
					console.log("p2p connection established as downstream.");
					rtp.set_peerconnection(peer_conn, function(cmd) {
						cmd2upstream_list.push(cmd);
					});
					rtcp.set_peerconnection(peer_conn);
					document.getElementById("uiCall").style.display = "block";
				});
			}
		},
		stop_p2p : function() {
			peer = null;
			document.getElementById("uiCall").style.display = "none";
			if (is_p2p_upstream) {
				rtp.set_passthrough_callback(null);
			} else {
				rtp.set_peerconnection(null);
				rtcp.set_peerconnection(null);
			}
		},
		start_call : function() {
			navigator.getUserMedia({
				video : false,
				audio : true
			}, function(stream) {
				var call = peer.call(upstream_uuid, stream);
				call.on('stream', function(remoteStream) {
					var audio = $('<audio autoplay />').appendTo('body');
					audio[0].src = (URL || webkitURL || mozURL)
						.createObjectURL(stream);
				});
			}, function(err) {
				console.log('Failed to get local stream', err);
			});
		},
		stop_call : function() {
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
		},
	};
	return self;
})();

app.receivedEvent('load index.js');
app.initialize();