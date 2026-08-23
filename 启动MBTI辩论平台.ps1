# MBTI 人格辩论平台 - 服务启动器
$ErrorActionPreference = "SilentlyContinue"

$ServerDir = "D:\mbti-debate-platform\server"
$Url = "http://localhost:3001"

# Find Node.js - try workbuddy node first, then system node
$NodeBin = $null
$paths = @(
    "C:\Users\老2\.workbuddy\binaries\node\versions\22.22.2\node.exe"
)

foreach ($p in $paths) {
    if (Test-Path $p) { $NodeBin = $p; break }
}

if (-not $NodeBin) {
    # Fallback: try to find node in PATH
    try { $null = Get-Command node -ErrorAction Stop; $NodeBin = "node" } catch {}
}

if (-not $NodeBin) {
    [System.Windows.MessageBox]::Show("找不到 Node.js，请先安装 Node.js", "错误", "OK", "Error")
    exit 1
}

# Check if already running
try {
    $r = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
    Start-Process $Url
    exit 0
} catch {}

# Start server in background
$proc = Start-Process -FilePath $NodeBin -ArgumentList "index.js" -WorkingDirectory $ServerDir -WindowStyle Minimized -PassThru

# Wait for server to be ready
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $r = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 1
        $ready = $true
        break
    } catch {}
}

if ($ready) {
    Start-Process $Url
    # Show minimal status window
    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Application
    $notify.Visible = $true
    $notify.Text = "MBTI 人格辩论平台 - 运行中`n访问 http://localhost:3001`n右键退出"
    
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $menu.Items.Add("打开辩论平台", $null, { Start-Process $Url }) | Out-Null
    $menu.Items.Add("停止服务并退出", $null, { 
        $notify.Visible = $false
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        [System.Windows.Forms.Application]::Exit()
    }) | Out-Null
    $notify.ContextMenuStrip = $menu
    
    [System.Windows.Forms.Application]::Run()
} else {
    [System.Windows.MessageBox]::Show("服务启动失败，请检查 D:\mbti-debate-platform\server", "错误", "OK", "Error")
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
