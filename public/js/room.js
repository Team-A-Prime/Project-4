let createPeerConnection = () => {
  const RTCconf = {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
  let pc = new RTCPeerConnection(RTCconf)

  pc.onicecandidate = event => {
    if (!event.candidate) return
    socket.send(JSON.stringify({
      type: 'new-ice-candidate',
      data: {
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      }
    }))
  }

  pc.addEventListener('addstream', event => {
    vid_other_1.srcObject = event.stream
    vid_other_1.play()
  })

  return pc
}

let pc = createPeerConnection()
let need_to_call = false
let self_stream = false
let connected = false

// Initialize local vedeo stream and start the call if someone else is in the room
navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(stream => {
  self_stream = stream
  pc.addStream(stream)
  vid_self.srcObject = stream
  vid_self.play()
}).catch(error => {
  alert("Failed to access webcam")
  console.error(error)
})

