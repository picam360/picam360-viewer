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
	var self = {
		set_callback : function(ws, callback) {
			ws.on('rtp', function(packets, rtp_callback) {
				// console.log("packets : " + packets.length);
				if (callback) {
					if (!Array.isArray(packets)) {
						packets = [packets];
					}
					// packets.sort(function(a, b) {
					// return PacketHeader(a).GetSequenceNumber()
					// - PacketHeader(b).GetSequenceNumber();
					// });
					for (var i = 0; i < packets.length; i++) {
						if (i == 0) {
							var cmd = callback(PacketHeader(packets[i]), true);
							rtp_callback(cmd);
						} else {
							callback(PacketHeader(packets[i]), false);
						}
					}
				} else {
					rtp_callback(null);
				}
			});
		}
	};
	return self;
}