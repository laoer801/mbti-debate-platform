const { app, BrowserWindow, Menu, shell, session } = require('electron')
const path = require('path')

// GPU 兼容修复：某些 Windows 环境 GPU 进程反复崩溃，彻底禁用 GPU 硬件加速 + 沙箱
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

let mainWindow = null

function isDev() {
  return !app.isPackaged
}

function getFrontendPath() {
  if (isDev()) {
    return path.join(__dirname, '..', 'client', 'dist')
  }
  return path.join(process.resourcesPath, 'client', 'dist')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'MBTI 人格辩论平台',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0a0a1a',
  })

  if (!isDev()) {
    Menu.setApplicationMenu(null)
  }

  const indexPath = path.join(getFrontendPath(), 'index.html')
  mainWindow.loadFile(indexPath)

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // v40：允许渲染进程申请麦克风权限（PK 房间语音输入）。
  // file:// 页面默认无权限处理器，getUserMedia/SpeechRecognition 会被直接拒绝
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture', 'mediaKeySystem']
    callback(allowed.includes(permission))
  })
  ses.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'audioCapture']
    return allowed.includes(permission)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
