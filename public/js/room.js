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
    if (window.clm) {
      // Oh boy we have face tracking
      video.style.height = '100%'
      video.style.maxWidth = '100%'
      setTimeout(() => {
        let vid_size = video.getBoundingClientRect()
        video.width = vid_size.width
        video.height = vid_size.height
        let ctracker = new clm.tracker()
        ctracker.init()
        ctracker.start(video)
        let overlay = document.createElement('canvas')
        overlay.id = `overlay_${pc.id}`
        overlay.className = 'overlay'
        overlay.width = vid_size.width
        overlay.height = vid_size.height
        overlay.style.left = vid_size.left+'px'
        overlay.style.top = vid_size.top+'px'
        document.body.appendChild(overlay)
        let ctx = overlay.getContext('2d')
        let mustache = new Image()
        let monocle = new Image()
        mustache.src = '/img/mustache.png'
        monocle.src = '/img/monocle.png'
        let draw = () => {
          requestAnimationFrame(draw)
          ctx.clearRect(0, 0, overlay.width, overlay.height)
          if (ctracker.getScore() > 0.45 || debug) {
            if (debug) ctracker.draw(overlay)
            let pos = ctracker.getCurrentPosition()
            if (pos) {
              let scale = Math.sqrt((pos[14][0] - pos[0][0])**2 + (pos[14][1] - pos[0][1])**2)/170

              let ang_mustache = Math.atan((pos[36][1]-pos[38][1])/(pos[36][0]-pos[38][0]))
              ctx.setTransform(scale, 0, 0, scale, pos[47][0], (pos[47][1]+pos[37][1])/2+10)
              ctx.rotate(ang_mustache)
              ctx.drawImage(mustache, -100, -50)
              ctx.setTransform(1,0,0,1,0,0)

              let ang_monocle = Math.atan((pos[30][1]-pos[28][1])/(pos[30][0]-pos[28][0]))
              ctx.setTransform(scale, 0, 0, scale, pos[32][0], pos[32][1])
              ctx.rotate(ang_monocle)
              ctx.drawImage(monocle, -65, -65)
              ctx.setTransform(1,0,0,1,0,0)

              if (debug) {
                ctx.font = '14px Monospace'
                ctx.fillText(`Probability: ${ctracker.getScore().toFixed(4)}`, 5, 15)
                ctx.fillText(`Convergence: ${ctracker.getConvergence().toFixed(4)}`, 5, 30)
                ctx.fillText(`Angle: ${ang_mustache.toFixed(4)} rads`, 5, 45)
                ctx.fillText(`Scale: ${scale.toFixed(4)}`, 5, 60)
              }
            }
          }
        }
        draw()
      }, 2000)
    } else {
      // No face tracking. Proceed normally
      let num_vids = [].concat($('#peer_videos > video')).length
      for (let vid of [].concat($('#peer_videos > video'))) {
        vid.style.maxWidth = 100/Math.ceil(Math.sqrt(num_vids))+'%'
        vid.style.height = 100/Math.ceil(Math.sqrt(num_vids))+'%'
      }
    }
  })

  if (self_stream) pc.addStream(self_stream)

  return pc
}

let pcs = {}
let need_to_call = false
let self_stream = false
let id = false
let name = localStorage.name || false
let debug = false

/**
 * Initiates a call to the room
 * @param {String[]} peer_ids - An array of peer ids to be called
 */
let call = (peer_ids) => {
  if (window.location.pathname.slice(0,3) == '/m-' && peer_ids.length > 1) {
    alert('Room full')
    return
  }
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
      pc.setRemoteDescription(new RTCSessionDescription(msg.data))
    },
    'new-ice-candidate': () => {
      const candidate = new RTCIceCandidate({
        sdpMLineIndex: msg.data.label,
        candidate: msg.data.candidate,
        sdpMid: msg.data.id
      })
      pc.addIceCandidate(candidate).catch(err => console.log('Error processing ICE candidate from '+msg.from, candidate))
    },
    // Methods specific to our signaling server
    'chat': () => {
      create_chat_line(msg.data, msg.from)
    },
    'init': () => {
      id = msg.id
      name = name||msg.name
      for (let line of msg.chats) {
        create_chat_line(line.data, line.from)
      }
      signaler.say('chat', {type: 'init', from: name?name:id})
      if (!msg.call_room) return
      self_stream ? call(msg.members) : (need_to_call = msg.members)
    },
    'close': () => {
      pc.close()
      $(`#peer_video_${pc.id}`).srcObject = null
      $(`#peer_video_${pc.id}`).remove()
      if (window.clm) {
        $(`#overlay_${pc.id}`).remove()
      }
      let num_vids = [].concat($('#peer_videos > video')).length
      for (let vid of [].concat($('#peer_videos > video'))) {
        vid.style.maxWidth = 100/Math.ceil(Math.sqrt(num_vids))+'%'
        vid.style.height = 100/Math.ceil(Math.sqrt(num_vids))+'%'
      }
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
navigator.mediaDevices.getUserMedia({audio: true, video: {
  width: { min: 640 },
  height: { min: 480 },
  facingMode: "user"
}}).then(stream => {
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
  signaler.say('chat', {type: 'close', from: name?name:id})
  for (let pc in pcs) {
    pcs[pc].close()
  }
})

let chat_input = $('#chat_wrapper > input')
// Send chat text
chat_input.addEventListener('keydown', e => {
  if (e.key == 'Enter') {
    if (chat_input.value[0] == '/') {
      let command = chat_input.value.slice(1).split(' ')
      if (command[0] == 'name' && command[1]) {
        signaler.say('chat', {type: 'name', from: name?name:id, text: command.slice(1).join(' ')})
        localStorage.name = command.slice(1).join(' ')
        name = command.slice(1).join(' ')
      }
      if (command[0] == 'debug') debug = !debug
    } else {
      signaler.say('chat', {type: 'message', from: name?name:id, text: chat_input.value})
    }
    chat_input.value = ''
    return false
  }
})

// Convienience method to create a chat line in the chatbox
let create_chat_line = (data, hash_string = data.from) => {
  let line_el = document.createElement('span')
  if (data.type == 'init') {
    line_el.className = 'chat-info'
    line_el.textContent = `${data.from} has joined`
  }
  if (data.type == 'close') {
    line_el.className = 'chat-info'
    line_el.textContent = `${data.from} has left`
  }
  if (data.type == 'name') {
    line_el.className = 'chat-info'
    line_el.textContent = `${data.from} is now known as ${data.text}`
  }
  if (data.type == 'message') {
    let from_el = document.createElement('span')
    from_el.textContent = data.from
    let text_el = document.createTextNode(`: ${data.text}`)
    line_el.appendChild(from_el)
    line_el.appendChild(text_el)
    // Hash name to set color
    let n = hash_string.split('').reduce((a,b)=>a+b.charCodeAt(0),0)
    from_el.style.color = `rgb(${n%256}, ${Math.floor(n**1.5%256)}, ${Math.floor(n**2%256)})`
  }
  $('#chatbox').appendChild(line_el)
  $('#chatbox').scrollTop = $('#chatbox').scrollHeight
}

$('.mute-button').addEventListener('click', () => {
  const enabled = self_stream.getAudioTracks()[0].enabled
  self_stream.getAudioTracks()[0].enabled = !enabled
  $('.mute-button').className = 'mute-button mute-'+(enabled?'enabled':'disabled')
  $('.mute-button').title = (enabled?'Unm':'M')+'ute your microphone'
})

$('#vid_self').addEventListener('click', () => {
  $('body').setAttribute('data-layout', ({
    'bottom-right': 'top-right',
    'top-right'   : 'top-left',
    'top-left'    : 'bottom-left',
    'bottom-left' : 'bottom-right'
  })[$('body').getAttribute('data-layout')])
})
