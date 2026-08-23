try {
  const electron = require('electron')
  console.log('electron type:', typeof electron)
  console.log('electron keys:', Object.keys(electron))
  console.log('app:', electron.app)
} catch(e) {
  console.error('Error:', e.message)
}
