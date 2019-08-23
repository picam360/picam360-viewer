
(function() {

function AudioHandler() {
	var m_audio;
	var m_audio_type = "stream";
	var m_audio = document.createElement('audio');
	document.body.appendChild(m_audio);

	var m_audio_buffer_size = 4096;
	var m_audio_contxt = new (window.AudioContext || window.webkitAudioContext);
	var m_audio_play = false;
	var m_audio_buffer = [];
	var m_audio_buffer_cur = 0;
	var m_sample_rate = 48000;
	var m_sample_resample = Math.round(m_sample_rate
		/ (m_sample_rate - m_audio_contxt.sampleRate));
	var m_sample_count = 0;
	var m_audio_script_proc = m_audio_contxt
		.createScriptProcessor(m_audio_buffer_size, 1, 1);
	m_audio_script_proc.onaudioprocess = function(audioProcessingEvent) {
		var inputBuffer = audioProcessingEvent.inputBuffer;
		var outputBuffer = audioProcessingEvent.outputBuffer;

		var inputData = inputBuffer.getChannelData(0);
		var outputData = outputBuffer.getChannelData(0);

		for (var i = 0; i < outputBuffer.length; i++) {
			var v;
			if (!m_audio_play || m_audio_buffer.length == 0) {
				v = 0;
			} else {
				v = m_audio_buffer[0][0][m_audio_buffer_cur];
				m_audio_buffer_cur++;
				if (m_sample_count % m_sample_resample == 0) {
					m_audio_buffer_cur++;
				}
				if (m_audio_buffer_cur >= m_audio_buffer[0][0].length) {
					m_audio_buffer.shift();
					m_audio_buffer_cur = 0;
				}
			}
			outputData[i] = v;
			m_sample_count++;
		}
	}
	var self = {
		loadAudio : function(audio_obj) {
			m_audio.srcObject = audio_obj;
		},
		pushAudioStream : function(left, right) {
			if (!m_audio_play) {
				return;
			}
			var cutoff;
			var count = 0;
			for (cutoff = m_audio_buffer.length - 1; cutoff > 0; cutoff--) {
				count += m_audio_buffer[cutoff][0].length;
				if (count > m_sample_rate) { // 1sec
					break;
				}
			}
			if (cutoff > 0) {
				m_audio_buffer = m_audio_buffer.slice(cutoff);
			}
			m_audio_buffer.push([left, right]);
		},
		setAudioEnabled : function(bln) {
			if (bln == m_audio_play) {
				return;
			}
			m_audio_play = bln;
			switch (m_audio_type) {
				case "buffer" :
					if (m_audio_play) {
						m_audio_source = m_audio_contxt.createBufferSource();
						m_audio_source.connect(m_audio_script_proc);
						m_audio_script_proc.connect(m_audio_contxt.destination);
						m_audio_source.start();
					} else {
						m_audio_source.stop();
						m_audio_source.disconnect(m_audio_script_proc);
						m_audio_script_proc
							.disconnect(m_audio_contxt.destination);
					}
					break;
				case "stream" :
				default :
					if (m_audio_play) {
						m_audio.load();
						m_audio.volume = 1.0;// max
						if (m_audio.readyState === 4) {
							m_audio.play();
						} else {
							m_audio
								.addEventListener('canplaythrough', function(e) {
									m_audio
										.removeEventListener('canplaythrough', arguments.callee);
									m_audio.play();
								});
						}
					} else {
						m_audio.pause();
					}
					break;
			}
		},
	};
	return self;
}
window.AudioHandler = AudioHandler;
})();