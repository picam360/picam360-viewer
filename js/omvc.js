var socket = null;
var omvc = OMVC();
function OMVC() {
	var controlValue = {
		// 0% - 100%
		Throttle : 0,
		// -180 - 180
		Roll : 0,
		// -180 - 180
		Pitch : 0,
		// -180 - 180
		Yaw : 0
	};
	var actuatorValue = {
		LeftTop : 0,
		LeftBottom : 0,
		RightTop : 0,
		RightBottom : 0
	};
	var debug_msg = "";

	var myAttitude_init = null;
	var vehicleAttitude_init = null;

	var myAttitude = {
		Roll : 0,
		Pitch : 0,
		Yaw : 0
	};
	
	var viewOffset = {
		Roll : 0,
		Pitch : 0,
		Yaw : 0
	};

	var vehicleAttitude = {
		Roll : 0,
		Pitch : 0,
		Yaw : 0
	};

	var OperationModeEnum = {
		Hobby : 0,
		Dive : 1,
		Drive : 2
	};
	
	var downloadAsFile = function(fileName, url) {
	    var a = document.createElement('a');
	    a.download = fileName;
	    a.href = url;
		a.target = "_blank";
	    a.click();
	};
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
	if(query['default-image-url'] && !query['socket']) {
		query['socket'] = "off";
	}
	
	function splitExt(filename) {
	    return filename.split(/\.(?=[^.]+$)/);
	}

	document.getElementById("overlay").style.display = "none";
	document.getElementById("infoTypeBox").style.display = "none";
	document.getElementById("debugMsgBox").style.display = "none";
	document.getElementById("actuatorMsgBox").style.display = "none";
	document.getElementById("attitudeMsgBox").style.display = "none";
	
	document.getElementById("movie_download_box").style.display = "none";

	var fpsMsgNode = document.createTextNode("");
	var controlMsgNode = document.createTextNode("");
	var debugMsgNode = document.createTextNode("");
	var actuatorMsgNode = document.createTextNode("");
	var attitudeMsgNode = document.createTextNode("");

	var operationMode = OperationModeEnum.Hobby;

	var command_processing = false;

	var ledValue = 0;

	var recording = false;
	
	var server_url = window.location.href.split('?')[0];
	
	var fov = 60;

	var self = {
		omvr : new OMVR(),
		init : function() {
			if(!query['socket'] || query['socket'] == "on") {
				self.initSocket();
			}
			self.initOmvr();
			self.initGamepadEventLisener();
			self.initKeyboardEventLisener();
			self.initDeviceOrientationEventLisener();
			self.initMouseEventLisener();
			self.initViewEventLisener();

			self.setOperationMode("dive");
			self.animate(0);
			
			if(query['view-offset']) {
				var split_values = query['view-offset'].split(',');
				viewOffset.Roll = Number(split_values[0]);
				viewOffset.Pitch = Number(split_values[1]);
				viewOffset.Yaw = Number(split_values[2]);
			}
			if(query['fov']) {
				fov = Number(query['fov']);
				self.omvr.setFov(fov);
			}
			if(query['auto-scroll'] == 'on') {
				setInterval(function(){					
					viewOffset.Yaw += fov/100;
				},100);
			}
			if(query['check-image-delay']) {
				self.omvr.checkImageDelay = Number(query['check-image-delay']);
			}			
			
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
			}
			
			function gestureEndHandler(e) {
			}
			
			if ("ongesturestart" in window) {
				document.addEventListener("gesturestart", gestureStartHandler, false);
				document.addEventListener("gesturechange", gestureChangeHandler, false);
				document.addEventListener("gestureend", gestureEndHandler, false);
			}
		},

		initOmvr : function() {
			// Add those text nodes where they need to go
			document.getElementById("fpsMsg").appendChild(fpsMsgNode);
			document.getElementById("controlMsg").appendChild(controlMsgNode);
			document.getElementById("debugMsg").appendChild(debugMsgNode);
			document.getElementById("actuatorMsg").appendChild(actuatorMsgNode);
			document.getElementById("attitudeMsg").appendChild(attitudeMsgNode);

			var num = Math.floor(Math.random() * 3);
			var defaultImageUrl = 'img/demo_image_' + num + '.jpeg';
			var imageUrl = server_url + 'img/picam360.jpeg?cache=no';
			if(query['default-image-url']) {
				defaultImageUrl = query['default-image-url'];
				imageUrl = "";
			}
			if(query['image-url']) {
				imageUrl = query['image-url'];
			}
			var requestAttitude = false;
			var canvas = document.getElementById('vrCanvas');
			self.omvr.init(canvas);
			self.omvr.setTexture(defaultImageUrl, null, imageUrl, null, true, false, null, {
				Roll : 90,
				Pitch : 0,
				Yaw : 90
			});
		},

		initSocket : function() {
			jQuery.getScript(server_url + 'socket.io/socket.io.js', function() {
				socket = io.connect(server_url);
				// サーバから受け取るイベント
				socket.on('connect', function() {
					self.omvr.checkImageLastUpdate = false;
					setInterval(function() {
						var _starttime = new Date();
						console.log('ping!!');
						socket.emit('ping');
						socket.emit('isRecording', function(bln){
							swRecord.setChecked(bln);
						});
					}, 1000);
				});
				socket.on('pong', function(obj) {
					console.log('pong!!');
					// console.log(obj);
					document.getElementById("chkConnect").checked = (obj.FlightTelemetryStats.Status) ? true : false;
					document.getElementById("chkArm").checked = (obj.FlightStatus.Armed) ? true : false;

					actuatorValue.LeftTop = obj.ActuatorCommand.ChannelIdx0;
					actuatorValue.LeftBottom = obj.ActuatorCommand.ChannelIdx3;
					actuatorValue.RightTop = obj.ActuatorCommand.ChannelIdx1;
					actuatorValue.RightBottom = obj.ActuatorCommand.ChannelIdx2;					
				});
				socket.on('msg', function(msg) {
					console.log('msg:' + msg);
					debug_msg = msg;
				});
				socket.on("disconnect", function(client) {
				});
			})
		},

		initGamepadEventLisener : function() {
			if (omgamepad) {
				var x = 0, y = 0, z = 0;
				omgamepad.gamepadCallback = function(key, value, count, states) {
					var enabled = (count == 1);
					if (count > 8 && (count % 2) == 0) {
						enabled = true;
					}
					switch (key) {
					case "button0":
						if (enabled) {
							controlValue.Throttle++;
							if (controlValue.Throttle > 100) {
								controlValue.Throttle = 100;
							}
						}
						break;
					case "button1":
						if (enabled) {
							controlValue.Throttle--;
							if (controlValue.Throttle < 0) {
								controlValue.Throttle = 0;
							}
						}
						break;
					case "button2":
						if (count == 1) {
							controlValue.Throttle = 0;
							controlValue.Roll = 0;
							controlValue.Pitch = 0;
							controlValue.Yaw = 0;
							socket.emit('setControlValue', controlValue, function(obj) {
							});
						}
						return;
						break;
					case "button3":
						if (count == 1) {
						}
						return;
						break;
					case "dpadRight":
						if (enabled) {
							x++;
						}
						break;
					case "dpadLeft":
						if (enabled) {
							x--;
						}
						break;
					case "dpadUp":
						if (enabled) {
							y++;
						}
						break;
					case "dpadDown":
						if (enabled) {
							y--;
						}
						break;
					case "leftBumper":
						if (enabled) {
						}
						break;
					case "rightBumper":
						if (count == 1) {
							if (states['button3'] > 0.0) {// Y button being
								// pushed , record
								// mode
								if (recording) {
									console.log("stop record!");
									var filename = moment().format('YYYYMMDD_hhmmss') + '.mp4';
									socket.emit('stopRecord', function() {
										console.log("save video!: " + filename);
										window.plugins.saveImage.saveVideoFromURL(server_url + filename + '?cache=no', null);
									});
									recording = false;
								} else {
									console.log("start record!");
									socket.emit('startRecord');
									recording = true;
								}
							} else {
								console.log("snap!");
								window.plugins.saveImage.saveImageFromURL(server_url + 'img/picam360.jpeg?cache=no', null);
							}
						}
						break;
					case "leftTrigger":
						if (enabled) {
							ledValue--;
							if (ledValue < 0) {
								ledValue = 0;
							}
							socket.emit('setUpperLedValue', ledValue);
							socket.emit('setBottomLedValue', ledValue);
						}
						break;
					case "rightTrigger":
						if (enabled) {
							ledValue++;
							if (ledValue > 100) {
								ledValue = 100;
							}
							socket.emit('setUpperLedValue', ledValue);
							socket.emit('setBottomLedValue', ledValue);
						}
						break;
					case "leftJoystickX":
						controlValue.Pitch = value * 45;
						self.setControlValue(controlValue);
						return;
						break;
					case "leftJoystickY":
						controlValue.Roll = -value * 45;
						self.setControlValue(controlValue);
						return;
						break;
					case "rightJoystickX":
						if (enabled) {
						}
						break;
					case "rightJoystickY":
						if (enabled) {
						}
						break;
					default:
						console.log("key : " + key + ", value : " + value);
						return;
					}
					var bln = self.incrementControlValue(x, y, z);
					if (bln) {
						x = y = z = 0;
					}
				}
			}
		},

		initKeyboardEventLisener : function() {
			var x = 0, y = 0, z = 0;
			window.onkeydown = function(e) {
				var count = 1;
				var key = String.fromCharCode(e.keyCode);
				switch (key) {
				case "1":
					if (count == 1) {
						ledValue--;
						if (ledValue < 0) {
							ledValue = 0;
						}
						socket.emit('setUpperLedValue', ledValue);
						socket.emit('setBottomLedValue', ledValue);
					}
					break;
				case "2":
					if (count == 1) {
						ledValue++;
						if (ledValue > 100) {
							ledValue = 100;
						}
						socket.emit('setUpperLedValue', ledValue);
						socket.emit('setBottomLedValue', ledValue);
					}
					break;
				case "3":
					if (count == 1) {
						socket.emit('startRecord');
					}
					break;
				case "4":
					if (count == 1) {
						socket.emit('stopRecord');
					}
					break;
				case "H":
					if (count == 1) {
						controlValue.Throttle++;
						if (controlValue.Throttle > 100) {
							controlValue.Throttle = 100;
						}
					}
					break;
				case "J":
					if (count == 1) {
						controlValue.Throttle--;
						if (controlValue.Throttle < 0) {
							controlValue.Throttle = 0;
						}
					}
					break;
				case "K":
					if (count == 1) {
						controlValue.Throttle = 0;
						controlValue.Roll = 0;
						controlValue.Pitch = 0;
						controlValue.Yaw = 0;
						socket.emit('setControlValue', controlValue, function(obj) {
						});
					}
					return;
					break;
				case "L":
					if (count == 1) {
					}
					return;
					break;
				case "D":
					if (count == 1) {
						x++;
					}
					break;
				case "A":
					if (count == 1) {
						x--;
					}
					break;
				case "W":
					if (count == 1) {
						y++;
					}
					break;
				case "X":
					if (count == 1) {
						y--;
					}
					break;
				case "I":
					if (count == 1) {
						z++;
					}
					break;
				case "O":
					if (count == 1) {
						z--;
					}
					break;
				default:
					console.log(key);
					return;
				}
				var bln = self.incrementControlValue(x, y, z);
				if (bln) {
					x = y = z = 0;
				}
			}
		},

		incrementControlValue : function(x, y, z) {
			if (!command_processing) {
				if (socket == null) {
					return false;
				}
				command_processing = true;

				if (operationMode == OperationModeEnum.Drive) {
					// var quat_correct = new
					// THREE.Quaternion().setFromEuler(new
					// THREE.Euler(THREE.Math.degToRad(x),
					// THREE.Math.degToRad(y), THREE.Math.degToRad(z), "ZYX"));
					// var quaternion = new THREE.Quaternion().setFromEuler(new
					// THREE.Euler(THREE.Math.degToRad(vehicleAttitude.Roll),
					// THREE.Math.degToRad(-vehicleAttitude.Pitch), THREE.Math
					// .degToRad(vehicleAttitude.Yaw), "ZYX"));
					// quaternion.multiply(quat_correct);
					// var euler = new
					// THREE.Euler().setFromQuaternion(quaternion, "ZYX");
					// controlValue.Roll = THREE.Math.radToDeg(euler.x);
					// controlValue.Pitch = THREE.Math.radToDeg(-euler.y);
					// controlValue.Yaw = THREE.Math.radToDeg(euler.z);

					function validateDeg(value) {
						if (value > 180) {
							value -= 360;
						}
						if (value < -180) {
							value += 360;
						}
						return value;
					}
					controlValue.Roll = validateDeg(controlValue.Roll + x);
					controlValue.Pitch = validateDeg(controlValue.Pitch + y);
					controlValue.Yaw = validateDeg(controlValue.Yaw + z);
				} else if (operationMode == OperationModeEnum.Hobby) {
					function validateDeg(value) {
						if (value > 180) {
							value -= 360;
						}
						if (value < -180) {
							value += 360;
						}
						return value;
					}
					controlValue.Roll = validateDeg(controlValue.Roll + x);
					controlValue.Pitch = validateDeg(controlValue.Pitch + y);
					controlValue.Yaw = validateDeg(controlValue.Yaw + z);
				}

				socket.emit('setControlValue', controlValue, function(obj) {
					command_processing = false;
				});
				setTimeout(function() {
					if (command_processing) {
						command_processing = false;
					}
				}, 5000);

				return true;
			}
			return false;
		},

		setControlValue : function(value) {
			if (!command_processing) {
				if (socket == null) {
					return false;
				}
				var isDone = false;
				command_processing = true;

				controlValue = value;

				socket.emit('setControlValue', controlValue, function(obj) {
					isDone = true;
					command_processing = false;
				});
				setTimeout(function() {
					if (isDone) {
						return;
					}
					command_processing = false;
				}, 5000);

				return true;
			}
			return false;
		},
		
		initDeviceOrientationEventLisener : function() {
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
					self.setMyAttitude({
						Roll : roll,
						Pitch : pitch,
						Yaw : yaw,
						Timestamp : 0
					});
				}
			});
		},

		initMouseEventLisener : function() {
			var down = false;
			var swipeable = false;
			var sx = 0, sz = 0;
			var mousedownFunc = function(ev) {
				if(ev.type == "touchstart") {
					ev.clientX = ev.pageX;
					ev.clientY = ev.pageY;
				}
				down = true;
				sx = ev.clientX;
				sz = ev.clientY;
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
				var dz = -(ev.clientY - sz);
				sx -= dx;
				sz -= dz;

				var theta = dx * fov / 300;
				var phi = -dz * fov / 300;
				
				viewOffset.Roll += phi;
				viewOffset.Pitch = 0;
				viewOffset.Yaw += theta;
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
		},

		initViewEventLisener : function() {
			document.getElementById("chkLevel").onclick = function(ev) {
				omvc.calibrateLevel();
			};
			document.getElementById("chkArm").onclick = function(ev) {
				omvc.setArm(document.getElementById('chkArm').checked);
			};
			document.getElementById("chkConnect").onclick = function(ev) {
				omvc.connectFcm(document.getElementById('chkConnect').checked);
			};
			document.getElementById("chkProxy").onclick = function(ev) {
				omvc.setUdpProxyEnabled(document.getElementById('chkProxy').checked);
			};
		},

		setUdpProxyEnabled : function(bln) {
			if (socket) {
				socket.emit('setUdpProxyEnabled', bln);
			}
		},

		animate : function(elapsedTime) {
			var quat_correct = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.Math.degToRad(viewOffset.Roll), THREE.Math.degToRad(0), THREE.Math.degToRad(0), "ZYX"));
			var quaternion = 
				new THREE.Quaternion().setFromEuler(
					new THREE.Euler(
						THREE.Math.degToRad(myAttitude.Roll),
						THREE.Math.degToRad(-myAttitude.Pitch),
						THREE.Math.degToRad(myAttitude.Yaw - viewOffset.Yaw),
					"ZYX"));
			quaternion.multiply(quat_correct);
			var euler = new THREE.Euler().setFromQuaternion(quaternion, "ZYX");
			var _myAttitude = {
				Roll : THREE.Math.radToDeg(euler.x),
				Pitch : THREE.Math.radToDeg(-euler.y),
				Yaw : THREE.Math.radToDeg(euler.z)
			};
			
			switch (operationMode) {
			case OperationModeEnum.Drive:
				self.omvr.setMyAttitude(_myAttitude);
				self.omvr.setVehicleAttitude({
					Roll : 90,
					Pitch : 0,
					Yaw : 0
				});
				break;
			case OperationModeEnum.Hobby:
				self.omvr.setMyAttitude({
					Roll : 180,
					Pitch : 0,
					Yaw : 0
				});
				self.omvr.setVehicleAttitude({
					Roll : 0,
					Pitch : 0,
					Yaw : 180
				});
				break;
			case OperationModeEnum.Dive:
			default:
				self.omvr.setMyAttitude(_myAttitude);
				self.omvr.setVehicleAttitude(vehicleAttitude);
				break;
			}

			self.omvr.animate(elapsedTime);

			{// status
				fpsMsgNode.nodeValue = self.omvr.fps.toFixed(1) + "fps";
				controlMsgNode.nodeValue = controlValue.Throttle.toFixed(0) + "%" + " " + controlValue.Roll + " " + controlValue.Pitch + " " + controlValue.Yaw;
				actuatorMsgNode.nodeValue = actuatorValue.LeftTop.toFixed(0) + " " + actuatorValue.RightTop + " " + actuatorValue.RightBottom + " " + actuatorValue.LeftBottom;
				debugMsgNode.nodeValue = debug_msg;
				attitudeMsgNode.nodeValue = myAttitude.Roll.toFixed(0) + "," + myAttitude.Pitch.toFixed(0) + "," + myAttitude.Yaw.toFixed(0);
				attitudeMsgNode.nodeValue += "\n" + vehicleAttitude.Roll.toFixed(0) + "," + vehicleAttitude.Pitch.toFixed(0) + "," + vehicleAttitude.Yaw.toFixed(0);
			}

			if (omgamepad) {
				omgamepad.handleGamepad();
			}

			requestAnimationFrame(self.animate);
		},

		connectFcm : function(value) {
			if (socket == null) {
				return;
			}
			socket.emit('connectFcm', function(res) {
			});
		},

		setArm : function(value) {
			if (socket == null) {
				return;
			}
			socket.emit('setArm', value, function(res) {
				controlValue = {
					Throttle : 0,
					Roll : 0,
					Pitch : 0,
					Yaw : 0
				};
			});
		},

		calibrateLevel : function() {
			if (socket == null) {
				return;
			}
			socket.emit('calibrateLevel', function(res) {
				document.getElementById("chkLevel").checked = false;
			});
		},

		setInfoboxEnabled : function(value) {
			var overlayElement = document.getElementById("overlay");
			overlayElement.style.display = value ? "block" : "none";
			var infoTypeBoxElement = document.getElementById("infoTypeBox");
			infoTypeBoxElement.style.display = value ? "block" : "none";
		},

		setInfoType : function(type, bln) {
			switch (type) {
			case "attitude":
				document.getElementById("attitudeMsgBox").style.display = bln ? "block" : "none";
				break;
			case "actuator":
				document.getElementById("actuatorMsgBox").style.display = bln ? "block" : "none";
				break;
			case "debug":
				document.getElementById("debugMsgBox").style.display = bln ? "block" : "none";
				break;
			}
		},

		setMyAttitude : function(value) {
			myAttitude = value;
			if (myAttitude_init == null) {
				myAttitude_init = value;
			} else {
				myAttitude.Yaw -= myAttitude_init.Yaw;
				if (vehicleAttitude_init != null) {
					myAttitude.Yaw += vehicleAttitude_init.Yaw;
				}
			}
		},

		setVehicleAttitude : function(value) {
			vehicleAttitude = value;
			if (vehicleAttitude_init == null) {
				vehicleAttitude_init = value;
			}
		},

		setOperationMode : function(mode) {
			switch (mode) {
			case "dive":
				myAttitude.Roll = 90;
				myAttitude.Pitch = 0;
				myAttitude.Yaw = 0;
				fov = 90;
				self.omvr.setFov(fov);
				operationMode = OperationModeEnum.Dive;
				break;
			case "drive":
				fov = 90;
				self.omvr.setFov(fov);
				operationMode = OperationModeEnum.Drive;
				break;
			case "hobby":
				fov = 100;
				self.omvr.setFov(fov);
				operationMode = OperationModeEnum.Hobby;
				break;
			}
		},
		
		record : function(bln) {
			if(bln) {
				swRecord.setChecked(false);
				var duration = document.getElementById("frame_duration").value;
				console.log("start record! duration=" + duration);
				document.getElementById("movie_download_box").style.display = "none";
				socket.emit('startRecord', duration);
			} else {
				console.log("stop record!");
				socket.emit('stopRecord', function(filename) {
					console.log("save video!: " + filename);
					document.getElementById("movie_download_link").href = "img/" + filename;
					document.getElementById("movie_download_link").download = filename;
					document.getElementById("movie_download_box").style.display = "block";
				});
			}
		},
		
		snap : function() {
			downloadAsFile('picam360.jpeg', 'img/picam360.jpeg');
		},
		
		selectFile : function(file) {
			var url = URL.createObjectURL(file);
			self.omvr.setTexture(url, file.type.split('/')[0], null, null, true, false, null, {
				Roll : 90,
				Pitch : 0,
				Yaw : 90
			});
		}
	};
	return self;
}