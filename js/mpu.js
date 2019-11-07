function MPU(plugin_host) {
	var m_plugin_host = plugin_host;
	var m_callback = null;
	var m_debugoutput_time = Date.now();
	var m_quat = new THREE.Quaternion(0, 0, 0, 1);
	var m_north_diff = 0;
	var m_north = 0;

	var self = {
		// return THREE.Quaternion
		get_quaternion : function() {
			return m_quat.clone();
		},
		get_north : function() {
			return m_north;
		},
		set_attitude : function(pitch, yaw, roll) {
			var quat = new THREE.Quaternion()
				.setFromEuler(new THREE.Euler(THREE.Math.degToRad(pitch), THREE.Math
					.degToRad(yaw), THREE.Math.degToRad(roll), "YXZ"));
			m_quat = quat;
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
			var quat = new THREE.Quaternion()
				.setFromEuler(new THREE.Euler(THREE.Math
					.degToRad(attitude.beta), THREE.Math
					.degToRad(attitude.alpha), THREE.Math
					.degToRad(-attitude.gamma), "YXZ"));
			m_quat = quat;
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
			if (DeviceMotionEvent 
					&& DeviceMotionEvent.requestPermission
					&& typeof DeviceMotionEvent.requestPermission === 'function') {
				DeviceMotionEvent.requestPermission();
			}
			window
				.addEventListener('deviceorientation', function(attitude) {
					if (attitude['detail']) {
						attitude = attitude['detail'];
					}
					var time = Date.now();
					if (attitude.alpha != null) {
						var quat = new THREE.Quaternion()
							.setFromEuler(new THREE.Euler(THREE.Math
								.degToRad(attitude.beta), THREE.Math
								.degToRad(attitude.alpha), THREE.Math
								.degToRad(-attitude.gamma), "YXZ"));
						var offset_quat = new THREE.Quaternion()
							.setFromEuler(new THREE.Euler(THREE.Math
								.degToRad(0), THREE.Math
								.degToRad(-window.orientation), THREE.Math
								.degToRad(0), "YXZ"));
						quat = quat.multiply(offset_quat);

						m_north = -attitude.webkitCompassHeading
							- window.orientation;
						var euler = new THREE.Euler()
							.setFromQuaternion(quat, "YXZ");
						if (Math.abs(euler.x * 180 / Math.PI) < 45
							&& Math.abs(euler.z * 180 / Math.PI) < 45) {
							m_north_diff = euler.y * 180 / Math.PI - m_north;
						}
						var north_diff_quat = new THREE.Quaternion()
							.setFromEuler(new THREE.Euler(THREE.Math
								.degToRad(0), THREE.Math
								.degToRad(-m_north_diff), THREE.Math
								.degToRad(0), "YXZ"));
						quat = north_diff_quat.multiply(quat);

						m_quat = quat;
						if (time - m_debugoutput_time > 500) {
							var euler = new THREE.Euler()
								.setFromQuaternion(quat, "YXZ");
							m_debugoutput_time = time;
							// console.log(attitude);
							m_plugin_host
								.log(sprintf("north=%.3f, diff=%.3f, x=%.3f, y=%.3f, z=%.3f", m_north, m_north_diff, euler.x
									* 180 / Math.PI, euler.y * 180 / Math.PI, euler.z
									* 180 / Math.PI), 5);
						}
					}
				});
		}
	};
	return self;
}