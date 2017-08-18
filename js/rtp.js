function PacketHeader(pack) {
	var view = new DataView(pack);
	var packetlength = view.byteLength;
	var payloadtype = view.getUint8(1, false) & 0x7F;
	var sequencenumber = view.getUint16(2, false);
	var timestamp = view.getUint32(4, false);
	var self = {
		GetSequenceNumber : function() {
			return sequencenumber;
		},
		GetTimestamp : function() {
			return timestamp;
		},
		GetPacketData : function() {
			return new Uint8Array(pack, 0, packetlength);
		},
		GetPacketLength : function() {
			return packetlength;
		},
		GetHeaderLength : function() {
			return 12;
		},
		GetPayloadType : function() {
			return payloadtype;
		},
		GetPayloadLength : function() {
			return packetlength - self.GetHeaderLength();
		},
		GetPayload : function() {
			return new Uint8Array(pack, self.GetHeaderLength(), self
				.GetPayloadLength());
		}
	};
	return self;
}

function Rtp() {
	var m_bandwidth = 0;
	var m_last_packet_time = Date.now();
	var m_debugoutput_time = Date.now();
	var m_ws = null;
	var m_conn = null;
	var m_callback = null;
	var m_passthrough_callback = null;
	var self = {
		packet_handler : function(packets, rtp_callback) {
			var packet_time = Date.now();
			var sum_packet = 0;
			// console.log("packets : " + packets.length);
			if (m_callback) {
				if (!Array.isArray(packets)) {
					packets = [packets];
				}
				// packets.sort(function(a, b) {
				// return PacketHeader(a).GetSequenceNumber()
				// - PacketHeader(b).GetSequenceNumber();
				// });
				for (var i = 0; i < packets.length; i++) {
					sum_packet += packets[i].byteLength;
					if (i == 0) {
						var cmd = m_callback(PacketHeader(packets[i]), true);
						rtp_callback(cmd);
					} else {
						m_callback(PacketHeader(packets[i]), false);
					}
				}
			} else {
				rtp_callback(null);
			}

			{ // bandwidth
				var diff_usec = (packet_time - m_last_packet_time) * 1000;
				var tmp = 8.0 * sum_packet / Math.max(diff_usec, 1); // Mbps
				var w = diff_usec / 1000000 / 10;
				m_bandwidth = m_bandwidth * (1.0 - w) + tmp * w;
				if (packet_time - m_debugoutput_time > 10 * 1000) {
					m_debugoutput_time = packet_time;
					console.log("bandwidth : " + m_bandwidth.toFixed(3)
						+ "Mbps");
				}
			}
			m_last_packet_time = packet_time;
		},
		set_callback : function(callback) {
			m_callback = callback;
		},
		set_passthrough_callback : function(callback) {
			m_passthrough_callback = callback;
		},
		set_websocket : function(ws) {
			m_ws = ws;
			if (!m_ws) {
				return;
			}
			ws.on('rtp', function(packets, rtp_callback) {
				if (ws != m_ws) {
					return;
				}
				self.packet_handler(packets, rtp_callback);
				if (m_passthrough_callback) {
					m_passthrough_callback(packets, rtp_callback);
				}
			});
		},
		set_peerconnection : function(conn, rtp_callback) {
			m_conn = conn;
			if (!m_conn) {
				return;
			}
			conn.on('data', function(data) {
				if (conn != m_conn) {
					return;
				}
				self.packet_handler(data, rtp_callback);
			});
		},
	};
	return self;
}