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

function Rtcp() {
	var m_sequencenumber = 0;
	var m_timestamp = 0;
	var m_src = 0;
	var m_ws = null;
	var m_conn = null;
	// copy ArrayBuffer
	function copy(dst, dst_offset, src, src_offset, len) {
		new Uint8Array(dst, dst_offset)
			.set(new Uint8Array(src, src_offset, len));
	}
	function string_to_buffer(src) {
		return (new Uint8Array([].map.call(src, function(c) {
			return c.charCodeAt(0)
		}))).buffer;
	}
	var self = {
		set_websocket : function(ws) {
			m_ws = ws;
		},
		set_peerconnection : function(conn) {
			m_conn = conn;
		},
		// @data : ArrayBuffer
		sendpacket : function(pack) {
			if (m_conn) {
				m_conn.send(pack);
			} else if (m_ws) {
				m_ws.emit('rtcp', pack);
			}
		},
		// @data : ArrayBuffer
		buildpacket : function(data, pt) {
			if (typeof data == 'string') {
				data = string_to_buffer(data);
			}
			var pack = new ArrayBuffer(12 + data.byteLength);
			copy(pack, 12, data, 0, data.byteLength);
			var view = new DataView(pack);
			view.setUint8(0, 0, false);
			view.setUint8(1, pt & 0x7F, false);
			view.setUint16(2, m_sequencenumber, false);
			view.setUint32(4, m_timestamp, false);
			view.setUint32(8, m_src, false);

			m_sequencenumber++;

			return pack;
		},
	};
	return self;
}