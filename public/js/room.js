/**
 * Constructs RTCPeerConnection and binds our event listeners to it
 * @param {String} id - Optional peer id
 * @return {RTCPeerConnection} The modified PeerConnection object
 */
let createPeerConnection = (id) => {
  const RTCconf = {"iceServers": [
    {"urls": ["stun:stun.l.google.com:19302"]},
    {"urls": [`turn:${window.location.host}:5349`], "username":"public", "credential":"a"}
  ]}
  let pc = new RTCPeerConnection(RTCconf)
  if (id) pc.id = id

  pc.onicecandidate = event => {
    if (!event.candidate) return
    signaler.say('new-ice-candidate', {
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, pc.id)
  }

  pc.addEventListener('addstream', event => {
    let video = document.createElement('video')
    $('#peer_videos').appendChild(video)
    video.id = `peer_video_${pc.id}`
    video.srcObject = event.stream
    video.play()
  })

  if (self_stream) pc.addStream(self_stream)

  return pc
}

let pcs = {}
let need_to_call = false
let self_stream = false
let connected = false
let id = false

/**
 * Initiates a call to the room
 * @param {String[]} peer_ids - An array of peer ids to be called
 */
let call = (peer_ids) => {
  for (let peer_id of peer_ids) {
    let pc = createPeerConnection(peer_id)
    pcs[peer_id] = pc
    pc.createOffer().then(desc => {
      pc.setLocalDescription(desc).then(() => {
        signaler.say('video-offer', desc, peer_id)
      })
    })
  }
}

/**
 * Websocket connection to signaling server, used to exchange negotiation messages with other peers
 */
const signaler = new WebSocket(`wss://${window.location.host}${window.location.pathname}`)

signaler.say = (type, data, to = false) => {
  signaler.send(JSON.stringify({type, data, to, from: id}))
}

signaler.onmessage = raw_message => {
  // msg is constructed out of a different "data" than we sent. i.e, raw_message.data.data exists
  const msg = JSON.parse(raw_message.data)

  let pc
  if (msg.from) {
    pc = pcs[msg.from] ? pcs[msg.from] : createPeerConnection(msg.from)
    pcs[msg.from] = pc
  }

  // All the ways to handle messages from the signaling server
  const handlers = {
    // Methods defined by the spec
    'video-offer': () => {
      pc.setRemoteDescription(new RTCSessionDescription(msg.data)).then(() => {
        pc.createAnswer().then(desc => {
          pc.setLocalDescription(desc).then(() => {
            signaler.say('video-answer', desc, pc.id)
          })
        })
      }).catch(err => console.error(err))
    },
    'video-answer': () => {
      if (!connected) {
        pc.setRemoteDescription(new RTCSessionDescription(msg.data))
        connected = true
      }
    },
    'new-ice-candidate': () => {
      const candidate = new RTCIceCandidate({
        sdpMLineIndex: msg.data.label,
        candidate: msg.data.candidate,
        sdpMid: msg.data.id
      })
      pc.addIceCandidate(candidate).catch(err => console.error(err))
    },
    // Methods specific to our signaling server
    'init': () => {
      id = msg.id
      if (!msg.call_room) return
      self_stream ? call(msg.members) : (need_to_call = msg.members)
    },
    'close': () => {
      pc.close()
      connected = false
      $(`#peer_video_${pc.id}`).srcObject = null
      $(`#peer_video_${pc.id}`).remove()
      pc = createPeerConnection()
      pc.addStream(self_stream)
    },
    'pong': () => {}
  }

  if (Object.keys(handlers).includes(msg.type)) {
    handlers[msg.type]()
  } else {
    console.error('Unknown message from server:', msg)
  }
}

// Initialize local vedeo stream and start the call if someone else is in the room
navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(stream => {
  self_stream = stream
  vid_self.srcObject = stream
  vid_self.play()
  if (need_to_call) call(need_to_call)
}).catch(error => {
  alert("Failed to access webcam")
  console.error(error)
})

// Heartbeat to keep the websocket open
window.setInterval(() => {
  signaler.say('ping')
}, 10000)

// Be nice and tell the signaling server we're leaving
window.addEventListener('beforeunload', () => {
  signaler.say('close')
  for (let pc of pcs) {
    pc.close()
  }
})

$('.mute-button').addEventListener('click', () => {
  const enabled = self_stream.getAudioTracks()[0].enabled
  self_stream.getAudioTracks()[0].enabled = !enabled
  $('.mute-button').className = 'mute-button mute-'+(enabled?'enabled':'disabled')
  $('.mute-button').title = (enabled?'Unm':'M')+'ute your microphone'
})

$('#vid_self').addEventListener('click', () => {
  $('#vid_self').setAttribute('data-pos', ({
    'bottom-right': 'top-right',
    'top-right'   : 'top-left',
    'top-left'    : 'bottom-left',
    'bottom-left' : 'bottom-right'
  })[$('#vid_self').getAttribute('data-pos')])
})
