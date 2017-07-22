function MPU() {
	var m_callback = null;
	var m_attitude = null;
	var self = {
		// return THREE.Quaternion
		get_quaternion : function() {
			if (!m_attitude) {
				return new THREE.Quaternion(0, 0, 0, 1);
			} else {
				return new THREE.Quaternion()
					.setFromEuler(new THREE.Euler(THREE.Math
						.degToRad(m_attitude.Pitch), THREE.Math
						.degToRad(m_attitude.Yaw), THREE.Math
						.degToRad(m_attitude.Roll), "YXZ"));
			}
		},
		set_attitude : function(pitch, yaw, roll) {
			m_attitude = {
				Roll : roll,
				Pitch : pitch,
				Yaw : yaw,
				Timestamp : 0
			};
		},
		set_callback : function(callback) {
			m_callback = callback;
		},
		init : function() {
			if (navigator.devicemotion) {
				var options = {
					frequency : 1000 / 100
				}; // 100fps

				var watchID_attitude = navigator.devicemotion
					.watchAttitude(self.onSuccess_attitude, self.onError_attitude, options);
			} else {
				self.initDeviceOrientationEventLisener();
			}
		},

		onSuccess_attitude : function(attitude) {
			m_attitude = {
				Roll : attitude.alpha,
				Pitch : attitude.beta,
				Yaw : attitude.gamma,
				Timestamp : attitude.timestamp
			};
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

		initDeviceOrientationEventLisener : function() {
			window.addEventListener('deviceorientation', function(attitude) {
				if (attitude['detail']) {
					attitude = attitude['detail'];
				}
				if (attitude.alpha != null) {
					var pitch = 0;
					var yaw = 0;
					var roll = 0;
					switch (window.orientation) {
						case 0 :
							pitch = attitude.beta;
							yaw = attitude.alpha;// unstable, attitude.alpha
							// is also unstable
							// yaw = -attitude.webkitCompassHeading;
							roll = -attitude.gamma;
							break;
						case 90 :
							pitch = -attitude.gamma;
							yaw = attitude.alpha + 180;
							roll = -attitude.beta;
							if (pitch < 0) {
								pitch = 180 + pitch;
								yaw = 180 + yaw;
								roll = 180 + roll;
							}
							break;
						case -90 :
							pitch = attitude.gamma;
							yaw = attitude.alpha;
							roll = attitude.beta;
							if (pitch < 0) {
								pitch = 180 + pitch;
								yaw = 180 + yaw;
								roll = 180 + roll;
							}
							break;
						default :
							return;
					}
					m_attitude = {
						Pitch : pitch % 360,
						Yaw : yaw % 360,
						Roll : roll % 360,
						Timestamp : 0
					};
				}
			});
		}
	};
	return self;
}