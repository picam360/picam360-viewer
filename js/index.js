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
var PT_FILE = 102;
var PT_CAM_BASE = 110;
var P2P_API_KEY = "v8df88o1y4zbmx6r";
var PUBLIC_VIEWER = "http://picam360.github.io/picam360-viewer/";
var SIGNALING_HOST = "peer.picam360.com";
var SIGNALING_PORT = 443;
var SIGNALING_SECURE = true;

var app = (function() {
	var tilt = 0;
	var socket;
	var m_view_fov = 90;
	var target_fps = 10;
	var auto_scroll = false;
	var view_offset_lock = false;
	var m_anti_delay = false;
	var m_fpp = false;
	var m_vertex_type = "";
	var debug = 0;

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
	var peer = null;
	var peer_conn = null;
	var peer_call = null;
	var p2p_uuid_call = "";
	var default_image_url = null;

	var cmd2upstream_list = [];
	var filerequest_list = [];

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

	function loadFile(path, callback) {
		var req = new XMLHttpRequest();
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback(req.responseText);
		}
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
				return m_view_fov;
			},
			set_fov : function(value) {
				self.send_command(CAPTURE_DOMAIN + "set_fov 0="
					+ value.toFixed(0));
			},
			set_stereo : function(value) {
				omvr.setStereoEnabled(value);
			},
			set_view_offset : function(value) {
				if (view_offset_lock) {
					return;
				}
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
			call : function(bln) {
				if (bln) {
					core.start_call();
				} else {
					core.stop_call();
				}
			},
			log : function(str, level) {
				if (level && level <= debug) {
					console.log(str);
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
				if (!event.data || event.data.charAt(0) != '{') {
					return;
				}
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

		getFile : function(path, callback) {
			var key = uuid();
			filerequest_list.push({
				filename : path,
				key : key,
				callback : callback
			});
			self.plugin_host.send_command(SERVER_DOMAIN + "get_file " + path
				+ " " + key);
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

		init_common_options : function(callback) {
			loadFile("common_config.json", function(txt) {
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
								if (callback) {
									callback();
								}
							}
						};
						console.log("loding : " + options.plugin_paths[idx]);
						script.src = options.plugin_paths[idx];

						document.head.appendChild(script);
					}
					load_plugin(0);
				} else {
					if (callback) {
						callback();
					}
				}
			});
		},

		init_options : function(callback) {
			// @data : uint8array
			self
				.getFile("config.json", function(data) {
					var _options = [];
					var txt = String.fromCharCode.apply("", data);
					if (txt) {
						_options = JSON.parse(txt);
					}
					if (_options.plugin_paths
						&& _options.plugin_paths.length != 0) {
						function load_plugin(idx) {
							self
								.getFile(_options.plugin_paths[idx], function(
									data) {
									var script_str = String.fromCharCode
										.apply("", data);
									var script = document
										.createElement('script');
									script.onload = function() {
										console.log("loaded : "
											+ _options.plugin_paths[idx]);
										if (create_plugin) {
											var plugin = create_plugin(self.plugin_host);
											plugins.push(plugin);
											create_plugin = null;
										}
										if (idx + 1 < _options.plugin_paths.length) {
											load_plugin(idx + 1);
										} else {
											for (var i = 0; i < plugins.length; i++) {
												if (plugins[i].init_options) {
													plugins[i]
														.init_options(_options);
												}
											}
											if (callback) {
												callback();
											}
										}
									};
									console.log("loding : "
										+ _options.plugin_paths[idx]);
									var blob = new Blob([data], {
										type : "text/javascript"
									});
									var url = window.URL || window.webkitURL;
									script.src = url.createObjectURL(blob);

									document.head.appendChild(script);
								});
						}
						load_plugin(0);
					} else {
						if (callback) {
							callback();
						}
					}
				});
		},

		init_network : function(callback) {
			// init network related matters
			// data stream handling
			rtp = Rtp();
			rtcp = Rtcp();
			// set rtp callback
			rtp
				.set_callback(function(packet, cmd_request) {
					if (packet.GetPayloadType() == PT_CAM_BASE) {// image
						if (mjpeg_decoder) {
							mjpeg_decoder.decode(packet.GetPayload(), packet
								.GetPayloadLength());
						}
						if (h264_decoder) {
							h264_decoder.decode(packet.GetPayload(), packet
								.GetPayloadLength());
						}
						if (cmd_request) {
							var key = new Date().getTime().toString();
							var fov = m_view_fov;
							var quat = mpu.get_quaternion();
							quat = self.plugin_host.get_view_offset()
								.multiply(quat);
							if (m_anti_delay) {
								fov = omvr.get_adaptive_texture_fov();
								if (m_fpp) {
									quat = omvr.predict_view_quaternion();
								}
							}
							var cmd = UPSTREAM_DOMAIN;
							cmd += sprintf("set_view_quaternion quat=%.3f,%.3f,%.3f,%.3f", quat.x, quat.y, quat.z, quat.w);
							cmd += sprintf(" fov=%.3f key=%s", fov.toFixed(0), key);
							return cmd;
						}
					} else if (packet.GetPayloadType() == PT_STATUS) {// status
						var str = String.fromCharCode
							.apply("", new Uint8Array(packet.GetPayload()));
						var split = str.split('"');
						var name = UPSTREAM_DOMAIN + split[1];
						var value = split[3];
						if (watches[name]) {
							watches[name](value);
						}
					} else if (packet.GetPayloadType() == PT_FILE) {// file
						var array = packet.GetPayload();
						var view = new DataView(array.buffer, array.byteOffset);
						var header_size = view.getUint16(0, false);
						var header = array.slice(2, 2 + header_size);
						var header_str = String.fromCharCode.apply("", header);
						var data = array.slice(2 + header_size);
						var key = "dummy";
						var split = header_str.split(" ");
						for (var i = 0; i < split.length; i++) {
							var separator = (/[=,\"]/);
							var _split = split[i].split(separator);
							if (_split[0] == "key") { // view quaternion
								key = _split[2];
							}
						}
						for (var i = 0; i < filerequest_list.length; i++) {
							if (filerequest_list[i].key == key) {
								filerequest_list[i].callback(data);
								filerequest_list.splice(i, 1);
								break;
							}
						}
					}
				});
			// command to upstream
			setInterval(function() {
				if (!cmd2upstream_list.length) {
					return;
				}
				var value = cmd2upstream_list.shift();
				var cmd = "<picam360:command id=\"" + app.rtcp_command_id
					+ "\" value=\"" + value + "\" />"
				rtcp.sendpacket(rtcp.buildpacket(cmd, 101));
				app.rtcp_command_id++;
			}, 10);// 100hz
			var query = GetQueryString();
			if (query['p2p-uuid']) {
				self.start_p2p(query['p2p-uuid'], function(peer_conn) {
					rtp.set_connection(peer_conn, function(cmd) {
						self.plugin_host.send_command(cmd);
					});
					rtcp.set_connection(peer_conn);
					callback();
				});
			} else {
				self.start_ws(function(socket) {
					rtp.set_connection(socket, function(cmd) {
						self.plugin_host.send_command(cmd);
					});
					rtcp.set_connection(socket);
					callback();
				});
			}
		},

		init_webgl : function() {
			canvas = document.getElementById('vrCanvas');
			// webgl handling
			omvr = OMVR();
			omvr
				.init(canvas, function() {
					setInterval(function() {
						var quat = self.plugin_host.get_view_quaternion()
							|| new THREE.Quaternion();
						var view_offset_quat = self.plugin_host
							.get_view_offset();
						var view_quat = view_offset_quat.multiply(quat);
						omvr.set_view_quaternion(view_quat);
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
						omvr.setViewFov(m_view_fov);
						omvr.setModel("equirectangular", "rgb");
						omvr.loadTexture(default_image_url);
					} else {
						omvr.setViewFov(m_view_fov);
						omvr.anti_delay = m_anti_delay;
						omvr.setModel("window", "rgb");
					}
					omvr.vertex_type_forcibly = m_vertex_type;

					// video decoder
					h264_decoder = H264Decoder();
					mjpeg_decoder = MjpegDecoder();
					h264_decoder.set_frame_callback(omvr.handle_frame);
					mjpeg_decoder.set_frame_callback(omvr.handle_frame);

					// motion processer unit
					mpu = MPU(self.plugin_host);
					mpu.init();

					// animate
					self.start_animate();
				});
		},

		init_watch : function() {
			self.plugin_host
				.add_watch("upstream.is_recording", function(value) {
					set_is_recording(value.toLowerCase() == 'true');
				});
			self.plugin_host.add_watch("upstream.p2p_num_of_members", function(
				value) {
				if (peer && value >= 2) {
					document.getElementById("uiCall").style.display = "block";
				} else {
					document.getElementById("uiCall").style.display = "none";
				}
			});
			self.plugin_host
				.add_watch("upstream.request_call", function(value) {
					if (p2p_uuid_call == value) {
						return;
					}
					p2p_uuid_call = value;
					if (!window.confirm('An incoming call')) {
						return;
					}
					navigator.getUserMedia({
						video : false,
						audio : true
					}, function(stream) {
						peer_call = new Peer({
							host : SIGNALING_HOST,
							port : SIGNALING_PORT,
							secure : SIGNALING_SECURE,
							key : P2P_API_KEY,
							debug : debug
						});
						var call = peer_call.call(p2p_uuid_call, stream);
						call.on('stream', function(remoteStream) {
							var audio = new Audio();
							if (navigator.userAgent.indexOf("Safari") > -1) {
								audio.srcObject = remoteStream;
							} else {
								audio.src = (URL || webkitURL || mozURL)
									.createObjectURL(remoteStream);
							}
							console.log("stream");
							audio.load();
							setTimeout(function() {
								audio.play();
							}, 2000);
						});
					}, function(err) {
						console.log('Failed to get local stream', err);
					});
				});
		},

		rtcp_command_id : 0,

		main : function() {
			app.receivedEvent('main');

			navigator.getUserMedia = navigator.getUserMedia
				|| navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

			document.getElementById("uiCall").style.display = "none";

			function parseBoolean(str) {
				return str == "yes" || str == "on" || str == "true";
			}
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
				m_view_fov = parseFloat(query['fov']);
			}
			if (query['vertex-type']) {
				m_vertex_type = query['vertex-type'];
			}

			if (query['fps']) {
				target_fps = parseFloat(query['fps']);
			}
			if (query['auto-scroll']) {
				auto_scroll = parseBoolean(query['auto-scroll']);
			}
			if (query['debug']) {
				debug = parseFloat(query['debug']);
			}
			if (query['view-offset-lock']) {
				view_offset_lock = parseBoolean(query['view-offset-lock']);
			}
			if (query['anti-delay']) {
				m_anti_delay = parseBoolean(query['anti-delay']);
			}
			if (query['fpp']) {
				m_fpp = parseBoolean(query['fpp']);
			}

			self.plugin_host = PluginHost(self);
			self.init_common_options();
			self.init_webgl();
			self.init_watch();
			self.init_network(function() {
				self.init_options();
			});
		},
		start_ws : function(callback) {
			// websocket
			jQuery.getScript(server_url + 'socket.io/socket.io.js', function() {
				// connect websocket
				socket = io.connect(server_url);

				socket.on("connect", function() {
					console.log("connected : " + socket.id);

					callback(socket);
				});
				socket.on("disconnect", function() {
					console.log("disconnected");
				});
				socket.on("custom_error", function(event) {
					console.log("error : " + event);
					switch (event) {
						case "exceeded_num_of_clients" :
							alert("The number of clients is exceeded.");
							break;
					}
				});
			});
		},
		start_p2p : function(p2p_uuid, callback) {
			peer = new Peer({
				host : SIGNALING_HOST,
				port : SIGNALING_PORT,
				secure : SIGNALING_SECURE,
				key : P2P_API_KEY,
				debug : debug
			});
			peer_conn = peer.connect(p2p_uuid, {
				constraints : {}
			});
			peer_conn.on('open', function() {
				console.log("p2p connection established as downstream.");
				callback(peer_conn);
			});
		},
		stop_p2p : function() {
			peer = null;
			document.getElementById("uiCall").style.display = "none";
		},
		start_call : function() {
			p2p_uuid_call = uuid();
			peer_call = new Peer(p2p_uuid_call, {
				host : SIGNALING_HOST,
				port : SIGNALING_PORT,
				secure : SIGNALING_SECURE,
				key : P2P_API_KEY,
				debug : debug
			});
			peer_call.on('call', function(call) {
				navigator.getUserMedia({
					video : false,
					audio : true
				}, function(stream) {
					call.answer(stream);
					call.on('stream', function(remoteStream) {
						var audio = new Audio();
						if (navigator.userAgent.indexOf("Safari") > -1) {
							audio.srcObject = remoteStream;
						} else {
							audio.src = (URL || webkitURL || mozURL)
								.createObjectURL(remoteStream);
						}
						audio.load();
						setTimeout(function() {
							audio.play();
						}, 2000);
					});
				}, function(err) {
					console.log('Failed to get local stream', err);
				});
			});
			self.plugin_host.send_command(SERVER_DOMAIN + "request_call "
				+ p2p_uuid_call);
		},
		stop_call : function() {
		},
		start_animate : function() {
			setInterval(function() {

				var divStatus = document.getElementById("divStatus");
				if (divStatus) {
					var status = "";
					status += "texture fps:"
						+ omvr.get_texture_fps().toFixed(3) + "<br/>";
					status += "texture ttl:"
						+ (omvr.get_texture_ttl() * 1000).toFixed(0)
						+ "ms<br/>";
					status += "texture elapsed:"
						+ (omvr.get_texture_elapsed() * 1000).toFixed(0)
						+ "ms<br/>";
					divStatus.innerHTML = status;
				}

				omvr.animate();
			}, 1000 / target_fps);
		},
	};
	return self;
})();

app.receivedEvent('load index.js');
app.initialize();