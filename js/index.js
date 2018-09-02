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
	var m_view_fov = 120;
	var target_fps = 10;
	var auto_scroll = false;
	var view_offset_lock = false;
	var m_afov = false;
	var m_fpp = false;
	var m_vertex_type = "";
	var debug = 0;

	// main canvas
	var canvas;
	// overlay
	var overlay;
	// webgl handling
	var omvr;
	// data stream handling
	var rtp;
	var rtcp;
	// video decoder
	var mjpeg_decoder;
	var h264_decoder;
	var h265_decoder;
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

	var m_frame_active = false;
	var m_menu_visible = false;
	var m_info = "";
	var m_menu = "";

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
	var query = GetQueryString();

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
		req.responseType = "arraybuffer";
		req.open("get", path, true);
		req.send(null);

		req.onload = function() {
			callback([new Uint8Array(req.response)]);
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
				self.set_stereo(split[1] == "true" || split[1] == "1");
			}
		}

		var self = {
			get_plugin : function(name) {
				for (var i = 0; i < plugins.length; i++) {
					if (name == plugins[i].name) {
						return plugins[i];
					}
				}
				return null;
			},
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
				m_view_fov = value;
				omvr.setViewFov(m_view_fov);
			},
			set_stereo : function(value) {
				omvr.setStereoEnabled(value);
				self.send_event("PLUGIN_HOST", value
					? "STEREO_ENABLED"
					: "STEREO_DISABLED");
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
				var key = uuid();
				self.send_command(SERVER_DOMAIN + "snap " + key);
				filerequest_list.push({
					filename : 'picam360.jpeg',
					key : key,
					callback : function(chunk_array) {
						var blob = new Blob(chunk_array, {
							type : "image/jpeg"
						});
						var url = (URL || webkitURL || mozURL)
							.createObjectURL(blob);
						downloadAsFile('picam360.jpeg', url);
					}
				});
			},
			rec : function() {
				if (is_recording) {
					var key = uuid();
					self.send_command(SERVER_DOMAIN + "stop_record " + key);
					filerequest_list.push({
						filename : 'picam360.mp4',
						key : key,
						callback : function(chunk_array) {
							var blob = new Blob(chunk_array, {
								type : "video/mp4"
							});
							var url = (URL || webkitURL || mozURL)
								.createObjectURL(blob);
							downloadAsFile('picam360.mp4', url);
						}
					});
				} else {
					self.send_command(SERVER_DOMAIN + "start_record");
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
			set_menu_visible : function(bln) {
				// self.send_command(CAPTURE_DOMAIN + 'set_menu_visible ' +
				// (bln?'1':'0'));
				m_menu_visible = bln;
				overlay.style.visibility = m_menu_visible
					? "visible"
					: "hidden";
			},
			set_info : function(str) {
				overlay.innerHTML = str;
			},
			getFile : function(path, callback) {
				if (!query['force-local'] && core.connected()) {
					var key = uuid();
					filerequest_list.push({
						filename : path,
						key : key,
						callback : callback
					});
					self.send_command(SERVER_DOMAIN + "get_file " + path + " "
						+ key);
				} else {
					loadFile(path, callback);
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
			loadFile("common_config.json", function(chunk_array) {
				var txt = String.fromCharCode.apply("", chunk_array[0]);
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
			self.plugin_host
				.getFile("config.json", function(chunk_array) {
					var _options = [];
					var txt = String.fromCharCode.apply("", chunk_array[0]);
					if (txt) {
						_options = JSON.parse(txt);
					}
					if (_options.fov && !query.fov) {
						self.plugin_host.set_fov(_options.fov);
					}
					if (_options.view_offset && !query['view-offset']) {
						var euler = new THREE.Euler(THREE.Math
							.degToRad(_options.view_offset[0]), THREE.Math
							.degToRad(_options.view_offset[1]), THREE.Math
							.degToRad(_options.view_offset[2]), "YXZ");

						view_offset = new THREE.Quaternion()
							.setFromEuler(euler);
					}
					if (_options.plugin_paths
						&& _options.plugin_paths.length != 0) {
						function load_plugin(idx) {
							self.plugin_host
								.getFile(_options.plugin_paths[idx], function(
									chunk_array) {
									var script_str = String.fromCharCode
										.apply("", chunk_array[0]);
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
									var blob = new Blob(chunk_array, {
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

		init_network : function(callback, err_callback) {
			// init network related matters
			// data stream handling
			rtp = Rtp();
			rtcp = Rtcp();
			// set rtp callback
			rtp.set_callback(function(packet) {
				if (packet.GetPayloadType() == PT_CAM_BASE) {// image
					if (mjpeg_decoder) {
						mjpeg_decoder.decode(packet.GetPayload(), packet
							.GetPayloadLength());
					}
					if (h264_decoder) {
						h264_decoder.decode(packet.GetPayload(), packet
							.GetPayloadLength());
					}
					if (h265_decoder) {
						h265_decoder.decode(packet.GetPayload(), packet
							.GetPayloadLength());
					}
				} else if (packet.GetPayloadType() == PT_STATUS) {// status
					var str = String.fromCharCode
						.apply("", new Uint8Array(packet.GetPayload()));
					var split = str.split('"');
					var name = UPSTREAM_DOMAIN + split[1];
					var value = decodeURIComponent(split[3]);
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
					var seq = 0;
					var eof = false;
					var split = header_str.split(" ");
					for (var i = 0; i < split.length; i++) {
						var separator = (/[=,\"]/);
						var _split = split[i].split(separator);
						if (_split[0] == "key") {
							key = _split[2];
						} else if (_split[0] == "seq") {
							seq = parseInt(_split[2]);
						} else if (_split[0] == "eof") {
							eof = _split[2] == "true";
						}
					}
					for (var i = 0; i < filerequest_list.length; i++) {
						if (filerequest_list[i].key == key) {
							if (seq == 0) {
								filerequest_list[i].chunk_array = [];
							}
							filerequest_list[i].chunk_array.push(data);
							if (eof) {
								filerequest_list[i]
									.callback(filerequest_list[i].chunk_array);
								filerequest_list.splice(i, 1);
								break;
							}
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
				rtcp.sendpacket(rtcp.buildpacket(cmd, PT_CMD));
				app.rtcp_command_id++;
			}, 10);// 100hz
			var connection_callback = function(conn) {
				var is_init = false;
				var init_con = function() {
					is_init = true;
					self.plugin_host.set_info("waiting image...");
					rtp.set_connection(conn);
					rtcp.set_connection(conn);
					callback();
				}
				var valid_timediff = 0;
				var min_rtt = 0;
				var ping_cnt = 0;
				var cmd = "<picam360:command id=\"0\" value=\"ping "
					+ new Date().getTime() + "\" />"
				var pack = rtcp.buildpacket(cmd, PT_CMD);
				rtcp.sendpacket(conn, pack);
				conn
					.on('data', function(data) {
						if (!is_init) {
							if (!Array.isArray(data)) {
								packets = [data];
							}
							var pack = PacketHeader(data[0]);
							if (pack.GetPayloadType() == PT_STATUS) {
								var str = String.fromCharCode
									.apply("", new Uint8Array(pack.GetPayload()));
								var split = str.split('"');
								var name = split[1];
								var value = split[3].split(' ');
								if (name == "pong") {
									ping_cnt++;
									var now = new Date().getTime();
									var rtt = now - parseInt(value[0]);
									var timediff = value[1] - (now - rtt / 2);
									if (min_rtt == 0 || rtt < min_rtt) {
										min_rtt = rtt;
										valid_timediff = timediff;
									}
									console.log(name + ":" + value + ":rtt="
										+ rtt);
									if (ping_cnt < 10) {
										var cmd = "<picam360:command id=\"0\" value=\"ping "
											+ new Date().getTime() + "\" />"
										var pack = rtcp
											.buildpacket(cmd, PT_CMD);
										rtcp.sendpacket(conn, pack);
										return;
									} else {
										var cmd = "<picam360:command id=\"0\" value=\"set_timediff "
											+ valid_timediff + "\" />";
										var pack = rtcp
											.buildpacket(cmd, PT_CMD);
										rtcp.sendpacket(conn, pack);

										console.log("min_rtt=" + min_rtt
											+ ":valid_timediff:"
											+ valid_timediff);
									}
								}
							}
							init_con();
						}
					});
			};
			if (query['p2p-uuid']) {
				self.plugin_host.set_info("connecting via webrtc...");
				self
					.start_p2p(query['p2p-uuid'], connection_callback, function() {
						err_callback();
					});
			} else {
				self.plugin_host.set_info("connecting via websocket...");
				self.start_ws(connection_callback, function() {
					err_callback();
				});
			}
		},

		handle_frame : function(type, data, width, height, info, time) {
			if (!m_frame_active) {
				self.plugin_host.set_info("");
				self.plugin_host.set_menu_visible(false);
				m_frame_active = true;
			}
			{
				var server_key = "";
				if (info) {
					var split = info.split(' ');
					for (var i = 0; i < split.length; i++) {
						var separator = (/[=,\"]/);
						var _split = split[i].split(separator);
						if (_split[0] == "server_key") {
							server_key = _split[2];
						}
					}
				}
				var client_key = new Date().getTime().toString();
				var fov = m_view_fov;
				var quat = self.plugin_host.get_view_quaternion()
					|| new THREE.Quaternion();
				var view_offset_quat = self.plugin_host.get_view_offset()
					|| new THREE.Quaternion();
				var view_quat = view_offset_quat.multiply(quat);
				if (m_afov) {
					fov = omvr.get_adaptive_texture_fov();
					fov = (fov / 5).toFixed(0) * 5;
				}
				if (m_fpp) {
					view_quat = omvr.predict_view_quaternion();
				}
				var cmd = UPSTREAM_DOMAIN;
				cmd += sprintf("set_view_quaternion quat=%.3f,%.3f,%.3f,%.3f", view_quat.x, view_quat.y, view_quat.z, view_quat.w);
				cmd += sprintf(" fov=%.3f client_key=%s server_key=%s", fov
					.toFixed(0), client_key, server_key);
				self.plugin_host.send_command(cmd);
			}

			omvr.handle_frame(type, data, width, height, info, time);
		},

		init_webgl : function() {
			// webgl handling
			omvr = OMVR();
			omvr
				.init(canvas, function() {
					setInterval(function() {
						var quat = self.plugin_host.get_view_quaternion()
							|| new THREE.Quaternion();
						var view_offset_quat = self.plugin_host
							.get_view_offset()
							|| new THREE.Quaternion();
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
						m_frame_active = true;
						omvr.setViewFov(m_view_fov);
						omvr.setModel("equirectangular", "rgb");
						omvr.loadTexture(default_image_url);
					} else {
						omvr.setViewFov(m_view_fov);
						omvr.setModel("window", "rgb");
					}
					omvr.vertex_type_forcibly = m_vertex_type;

					// video decoder
					h264_decoder = H264Decoder();
					mjpeg_decoder = MjpegDecoder();
					h265_decoder = H265Decoder();
					h264_decoder.set_frame_callback(self.handle_frame);
					mjpeg_decoder.set_frame_callback(self.handle_frame);
					h265_decoder.set_frame_callback(self.handle_frame);

					// motion processer unit
					mpu = MPU(self.plugin_host);
					mpu.init();

					// animate
					self.start_animate();
				});
		},

		init_watch : function() {
			self.plugin_host.add_watch("upstream.error", function(value) {
				switch (value.toLowerCase()) {
					case "exceeded_num_of_clients" :
						self.plugin_host
							.set_info("error : Exceeded num of clients");
						break;
				}
			});
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
			self.plugin_host.add_watch("upstream.info", function(value) {
				m_info = value;
			});
			self.plugin_host.add_watch("upstream.menu", function(value) {
				m_menu = value;
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
			if (query['afov']) {
				m_afov = parseBoolean(query['afov']);
			}
			if (query['fpp']) {
				m_fpp = parseBoolean(query['fpp']);
			}

			canvas = document.getElementById('panorama');
			overlay = document.getElementById('overlay');

			self.plugin_host = PluginHost(self);
			self.plugin_host.set_menu_visible(true);
			self.init_common_options();
			self.init_webgl();
			self.init_watch();
			self.init_network(function() {
				self.init_options();
			}, function() {
				self.init_options();
			});
		},
		start_ws : function(callback, err_callback) {
			// websocket
			jQuery.getScript(server_url + 'socket.io/socket.io.js')
				.done(function(script, textStatus) {
					// connect websocket
					socket = io.connect(server_url);

					socket.on("connect", function() {
						console.log("connected : " + socket.id);

						callback(socket);
					});
					socket.on("disconnect", function() {
						self.plugin_host
							.set_info("websocket connection closed");
						self.plugin_host.set_menu_visible(true);
						m_frame_active = false;
					});
				}).fail(function(jqxhr, settings, exception) {
					self.plugin_host.set_info("error : Could not connect");
					err_callback();
				});
		},
		start_p2p : function(p2p_uuid, callback, err_callback) {
			peer = new Peer({
				host : SIGNALING_HOST,
				port : SIGNALING_PORT,
				secure : SIGNALING_SECURE,
				key : P2P_API_KEY,
				reliable : (query.webrtc_udp == 'true'),
				debug : debug
			});
			peer.on('error', function(err) {
				if (err.type == "peer-unavailable") {
					self.plugin_host.set_info("error : Could not connect "
						+ p2p_uuid);
					peer = null;
					err_callback();
				}
			});
			peer_conn = peer.connect(p2p_uuid, {
				constraints : {}
			});
			peer_conn.on('open', function() {
				console.log("p2p connection established as downstream.");
				callback(peer_conn);
				peer_conn.on('close', function() {
					self.plugin_host.set_info("p2p connection closed");
					self.plugin_host.set_menu_visible(true);
					m_frame_active = false;
				});
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
						self.plugin_host.send_command(SERVER_DOMAIN
							+ "request_call " + "");// reset
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
		connected : function() {
			return (socket != null || peer != null);
		},
		start_animate : function() {
			setInterval(function() {
				if (!m_frame_active) {
					return;
				}
				var divStatus = document.getElementById("divStatus");
				if (divStatus) {
					var status = "";
					var texture_info = omvr.get_info();
					{
						status += "texture<br/>";
						status += "fps:" + texture_info.fps.toFixed(3)
							+ "<br/>";
						status += "latency:"
							+ (texture_info.latency * 1000).toFixed(0)
							+ "ms<br/>";
						status += "processed:"
							+ (texture_info.processed * 1000).toFixed(0)
							+ "ms<br/>";
						status += "encoded:"
							+ (texture_info.encoded * 1000).toFixed(0)
							+ "ms<br/>";
						status += "decoded:"
							+ (texture_info.decoded * 1000).toFixed(0)
							+ "ms<br/>";
						status += "rtt:" + (texture_info.rtt * 1000).toFixed(0)
							+ "ms<br/>";
						status += "<br/>";
					}

					{
						var rtp_info = rtp.get_info();
						status += "packet<br/>";
						status += "bitrate:" + rtp_info.bitrate.toFixed(3)
							+ "Mbit/s<br/>";
						status += "<br/>";
					}

					{
						status += "upstream<br/>";
						status += m_info.replace(/\n/gm, "<br/>");
						status += "<br/>";
					}

					divStatus.innerHTML = status;
				}
				if (m_menu_visible) {
					var info = "";
					{
						var defualt_color = "#ffffff";
						var activated_color = "#00ffff";
						var selected_color = "#ff00ff";
						var marked_color = "#ffff00";
						var rows = m_menu.split("\n");
						var _nodes_index = rows[0].split(",");
						var nodes_index = [];
						for (var i = 0; i < _nodes_index.length; i++) {
							nodes_index[_nodes_index[i].toLowerCase()] = i;
						}
						info += "<pre align=\"left\">";
						for (var i = 1; i < rows.length; i++) {
							if (!rows[i]) {
								continue;
							}
							var nodes = rows[i].split(",");
							var color = nodes[nodes_index["selected"]] == "1"
								? selected_color
								: nodes[nodes_index["activated"]] == "1"
									? activated_color
									: nodes[nodes_index["marked"]] == "1"
										? marked_color
										: defualt_color;
							info += " ".repeat(4 * nodes[nodes_index["depth"]])
								+ "<font color=\"" + color + "\">"
								+ nodes[nodes_index["name"]] + "</font>"
								+ "<br/>";
						}
						info += "</pre>";
					}

					self.plugin_host.set_info(info);
				}

				omvr.animate();
			}, 1000 / target_fps);
		},
	};
	return self;
})();

app.receivedEvent('load index.js');
app.initialize();