const assert = require('assert')
const WebSocket = require('ws')

let server, c1, c2

describe('Start signaling server', function() {
  it('should start', function() {
    server = require('../src/index.js')
    assert(typeof server.rooms == 'object')
  })
})

describe('Create client 1', function() {
  it('should connect to server', function(done) {
    c1 = new WebSocket(`ws://localhost:${process.env.NODE_PORT || 8087}/foo`)
    c1.messages = []
    c1.on('message', raw_message => {
      let msg = JSON.parse(raw_message)
      if (msg.type == 'init') {
        c1.id = msg.id
        done()
      } else {
        c1.messages.push(msg)
      }
    })
  })
})

describe('Create client 2', function() {
  it('should connect to server', function(done) {
    c2 = new WebSocket(`ws://localhost:${process.env.NODE_PORT || 8087}/foo`)
    c2.messages = []
    c2.on('message', raw_message => {
      let msg = JSON.parse(raw_message)
      if (msg.type == 'init') {
        c2.id = msg.id
        done()
      } else {
        c2.messages.push(msg)
      }
    })
  })
})

describe('Message passing', function() {
  it('client 1 sends message', function(done) {
    c1.send(JSON.stringify({type: 'test', data: 'abc', from: c1.id}), done)
  })
  it('client 1 does not receive own message', function() {
    assert(c1.messages.length === 0)
  })
  it('client 2 receives message', function() {
    assert(c2.messages.pop().data === 'abc')
  })
  it('client 1 sends private message to nobody', function(done) {
    c1.send(JSON.stringify({type: 'test', data: 'cba', from: c1.id, to: 'NOT c2'}), done)
  })
  it('client 2 does NOT receive private message', function() {
    assert(c2.messages.length === 0)
  })
  it('client 1 sends chat', function(done) {
    c1.send(JSON.stringify({type: 'chat', data: '123', from: c1.id}), done)
  })
  it('clients 1 and 2 receive chat message', function() {
    assert(c1.messages.pop().data === '123')
    assert(c2.messages.pop().data === '123')
  })
})

describe('Destroy signaling server', function() {
  it('should stop', function(done) {
    server._server.close()
    server.close(done)
  })
})
