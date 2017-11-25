const express = require('express')
const WebSocket = require('ws')

const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const app = express()
app.use(express.static('./public'))

app.get('/:roomid', (req, res) => {
  if (!wss.rooms[req.params.roomid]) {
    wss.rooms[req.params.roomid] = []
  }
  res.sendfile('./public/room.html')
})

/**
 * Webserver for static files
 */
const server = app.listen(process.env.NODE_PORT || 8087)

/**
 * Websocket signaling server for exchanging negotiation messages between peers
 */
const wss = new WebSocket.Server({ server })

/**
 * List of chat-rooms
 */
wss.rooms = {}

wss.on('connection', (socket, req) => {
  if (req.url.length < 2) {
    socket.close()
    return
  }
  let room = req.url.slice(1)
  socket.id = Array.from({length: 32}).map(()=>chars[Math.floor(Math.random()*chars.length)]).join('')
  wss.rooms[room] = wss.rooms[room] || {}
  wss.rooms[room].members = wss.rooms[room].members || []
  wss.rooms[room].chats = wss.rooms[room].chats || []
  wss.rooms[room].members.push(socket)
  let init_mes = {
    type: 'init',
    id: socket.id,
    call_room: (wss.rooms[room].members.length > 1),
    chats: wss.rooms[room].chats,
    name: `User${Math.floor(Math.random()*10000)}`,
    members: wss.rooms[room].members.map(sock => sock.id).filter(id => id != socket.id)
  }
  socket.send(JSON.stringify(init_mes))
  socket.on('message', data => {
    let msg = JSON.parse(data)
    if (msg.type == 'ping') {
      socket.send(JSON.stringify({type:'pong'}))
      return
    }
    if (msg.type == 'chat') {
      wss.rooms[room].chats.push({data: msg.data, from: msg.from})
    }
    for (let sock of wss.rooms[room].members) {
      if (sock.readyState > 1) {
        wss.rooms[room].members = wss.rooms[room].members.filter(s => s.readyState < 2)
        continue
      }
      if (msg.to && msg.to != sock.id) continue
      if (sock.id == socket.id && msg.type != 'chat') continue
      sock.send(JSON.stringify(msg))
    }
    if (msg.type == 'close') {
      socket.close()
      wss.rooms[room].members = wss.rooms[room].members.filter(s => s.readyState < 2)
    }
  })
  socket.on('close', () => {
    if (wss.rooms[room].members.length == 0) wss.rooms[room] = false
  })
})
