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
			return new Uint8Array(pack, self.GetHeaderLength(), self.GetPayloadLength());
		}
	};
	return self;
}

function Rtp() {
	var self = {
		set_callback : function(ws, callback) {
			ws.on('rtp', function(packet, rtp_callback) {
				//console.log("packet : " + packet.byteLength);
				rtp_callback();
				if (callback) {
					callback(PacketHeader(packet));
				}
			});
		}
	};
	return self;
}