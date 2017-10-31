$('form#join-container').addEventListener('submit', e => {
  e.preventDefault()
  let room = $('form#join-container input[name="room"]').value
  if (!room) room = randomPhrase(3)
  window.location.replace('//'+window.location.host+'/'+room)
})
