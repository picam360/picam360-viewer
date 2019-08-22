var m_ping_started = false;
function Signaling(options) {
	var data_host = "";
	var PING_TO_DATA_HOST_INTERVAL = 10000;
	
	function randomToken() {
		return Math.random().toString(36).substr(2);
	}
	function get_unique_id(callback) {
		var http = new XMLHttpRequest();
		var protocol = options.secure ? 'https://' : 'http://';
		var url = protocol + options.host + ':' + options.port + '/'
			+ options.key + '/id';
		var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
		url += queryString;

		// If there's no ID we need to wait for one before trying to init
		// socket.
		http.open('get', url, true);
		http.onerror = function(e) {
			console
				.log('server-error:Could not get an ID from the server.' + e);
		};
		http.onreadystatechange = function() {
			if (http.readyState !== 4) {
				return;
			}
			if (http.status !== 200) {
				http.onerror();
				return;
			}
			callback(http.responseText);
		};
		http.send(null);
	}
	var self = {
		socket : null,
		disconnected : true,
		local_peer_id : '',
		token : randomToken(),
		onoffer : function() {
		},
		onrequestoffer : function() {
		},
		onanswer : function() {
		},
		oncandidate : function() {
		},
		onclose : function() {
		},
		onerror : function() {
		},
		connect : function(callback) {
			function _connect(id) {
				self.local_peer_id = id;

				var protocol = options.secure ? 'wss://' : 'ws://';
				var url = protocol + options.host + ':' + options.port
					+ '/peerjs';
				var queryString = '?key=' + options.key + '&id='
					+ self.local_peer_id + '&token=' + self.token
				url += queryString;
				self.socket = new WebSocket(url);
				self.socket.onmessage = function(event) {
					try {
						var data = JSON.parse(event.data);
					} catch (e) {
						console.log('Invalid server message:' + event.data);
						return;
					}
					switch (data.type) {
						case 'OPEN' :
							callback();
							break;
						case 'OFFER' :
							if (data.payload.type == 'request') {
								self.onrequestoffer(data);
							} else {
								self.onoffer(data);
							}
							break;
						case 'ANSWER' :
							self.onanswer(data);
							break;
						case 'CANDIDATE' :
							self.oncandidate(data);
							break;
					}
				};

				self.socket.onclose = function(event) {
					console.log('Socket closed.');
					self.disconnected = true;
					self.onclose(event);
				};

				self.socket.onopen = function() {
					console.log('Socket open');
				};
			}
			if (options.local_peer_id) {
				_connect(options.local_peer_id);
			} else {
				get_unique_id(function(id) {
					_connect(id);
				});
			}
		},
		request_offer : function(uuid) {
			var data = {
				type : 'OFFER',
				payload : {
					type : 'request',
				},
				dst : uuid,
			};
			var message = JSON.stringify(data);
			self.socket.send(message);
		},
		offer : function(uuid, sdp) {
			var data = {
				type : 'OFFER',
				payload : {
					type : 'offer',
					sdp : sdp,
				},
				dst : uuid,
			};
			var message = JSON.stringify(data);
			self.socket.send(message);
		},
		answer : function(uuid, sdp) {
			var data = {
				type : 'ANSWER',
				payload : {
					type : 'answer',
					sdp : sdp,
				},
				dst : uuid,
			};
			var message = JSON.stringify(data);
			self.socket.send(message);
		},
		candidate : function(uuid, ice) {
			var data = {
				type : 'CANDIDATE',
				payload : {
					type : 'candidate',
					ice : ice,
				},
				dst : uuid,
			};
			var message = JSON.stringify(data);
			self.socket.send(message);
		},
		start_ping : function(id) {
			if (m_ping_started) {
				return;
			}
			m_ping_started = true;

			var http = new XMLHttpRequest();
			var protocol = options.secure ? 'https://' : 'http://';
			var url = protocol + options.host + ':' + options.port + '/'
				+ options.key + '/data_host';

			console.log("IN getDataHost");

			http.open('get', url, true);
			http.onerror = function(e) {
				util.error('Error getDataHost', e);
			};
			http.onreadystatechange = function() {
				if (http.readyState !== 4) {
					return;
				}
				if (http.status !== 200) {
					http.onerror();
					return;
				}

				console.log("SUCCESS getDataHost %s", http.responseText);
				data_host = http.responseText;

				var _pingToDataHost = function() {
					if (data_host) {
						var http = new XMLHttpRequest();
						var protocol = options.secure ? 'https://' : 'http://';
						var url = protocol + data_host;

						http.open('POST', url, true);
						http
							.setRequestHeader('Content-Type', 'application/json');
						http
							.setRequestHeader('Authorization', 'Token token=mzi9vncbbo');

						http.onerror = function(e) {
							console.log('Error _ping : ' + e);
						};
						http.onreadystatechange = function() {
							if (http.readyState !== 4) {
								return;
							}
							if (http.status !== 200) {
								http.onerror();
								return;
							}

							console.log("RESPONSE _ping %s", http.responseText);
						};

						var data = JSON.stringify({
							method : "ping",
							app_key : options.local_peer_id,
						});
						console.log(data);
						http.send(data);
					}
				}

				_pingToDataHost();// do ping once first
				setInterval(function() {
					_pingToDataHost();
				}, PING_TO_DATA_HOST_INTERVAL);
			};
			http.send(null);
		},
	};
	return self;
}
if (exports) {
	exports.Signaling = Signaling;
}