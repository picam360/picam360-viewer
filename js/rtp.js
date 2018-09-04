function PacketHeader(pack) {
	var view = new DataView(pack);
	var packetlength = view.byteLength;
	var payloadtype = view.getUint8(1, false) & 0x7F;
	var sequencenumber = view.getUint16(2, false);
	var timestamp = view.getUint32(4, false);
	var ssrc = view.getUint32(8, false);
	var self = {
		GetSequenceNumber : function() {
			return sequencenumber;
		},
		GetTimestamp : function() {
			return timestamp;
		},
		GetSsrc : function() {
			return ssrc;
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
	var m_bitrate = 0;
	var m_last_packet_time = Date.now();
	var m_ws = null;
	var m_conn = null;
	var m_callback = null;
	var m_passthrough_callback = null;
	var self = {
		get_info : function() {
			var info = {
				bitrate : m_bitrate,
			};
			return info;
		},
		packet_handler : function(packets) {
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
					m_callback(PacketHeader(packets[i]));
				}
			}

			{ // bitrate
				var diff_usec = (packet_time - m_last_packet_time) * 1000;
				var tmp = 8.0 * sum_packet / Math.max(diff_usec, 1); // Mbps
				var w = diff_usec / 1000000 / 10;
				m_bitrate = m_bitrate * (1.0 - w) + tmp * w;
			}
			m_last_packet_time = packet_time;
		},
		set_callback : function(callback) {
			m_callback = callback;
		},
		set_passthrough_callback : function(callback) {
			m_passthrough_callback = callback;
		},
		set_connection : function(conn) {
			m_conn = conn;
			if (!m_conn) {
				return;
			}
			conn.on('data', function(data) {
				if (conn != m_conn) {
					return;
				}
				self.packet_handler(data);
			});
		},
	};
	return self;
}