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

const server = app.listen(process.env.NODE_PORT || 8087)
const wss = new WebSocket.Server({ server })

wss.rooms = {}

wss.on('connection', (socket, req) => {
  if (req.url.length < 2) {
    socket.close()
    return
  }
  let room = req.url.slice(1)
  socket.id = Array.from({length: 32}).map(()=>chars[Math.floor(Math.random()*chars.length)]).join('')
  socket.room = room
  wss.rooms[room] = wss.rooms[room] || []
  wss.rooms[room].push(socket)
  let init_mes = {
    type: 'init',
    id: socket.id,
    call_room: (wss.rooms[room].length > 1)
  }
  socket.send(JSON.stringify(init_mes))
  socket.on('message', data => {
    let msg = JSON.parse(data)
    if (msg.type == 'ping') {
      socket.send(JSON.stringify({type:'pong'}))
      return
    }
    for (let sock of wss.rooms[socket.room]) {
      if (sock.readyState > 1) {
        wss.rooms[socket.room] = wss.rooms[socket.room].filter(s => s.readyState < 2)
        continue
      }
      if (sock.id !== socket.id) {
        sock.send(JSON.stringify(msg))
      }
    }
    if (msg.type == 'close') {
      socket.close()
      wss.rooms[socket.room] = wss.rooms[socket.room].filter(s => s.readyState < 2)
    }
  })
})
