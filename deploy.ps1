# AI交易竞技场模拟平台 - 一键部署脚本 (Windows PowerShell)
# 使用方法: 右键 -> 使用 PowerShell 运行，或在 PowerShell 中执行: .\deploy.ps1

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "config", "help")]
    [string]$Command = "start"
)

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Err { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "backend"
$FrontendDir = Join-Path $ScriptDir "frontend"
$EnvFile = Join-Path $BackendDir ".env"

# 检查命令是否存在
function Test-Command {
    param($Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

# 安装 Chocolatey
function Install-Chocolatey {
    if (-not (Test-Command "choco")) {
        Write-Info "正在安装 Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
}

# 安装 Python
function Install-Python {
    Write-Info "正在安装 Python..."
    Install-Chocolatey
    choco install python311 -y
    refreshenv
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# 安装 Node.js
function Install-NodeJS {
    Write-Info "正在安装 Node.js..."
    Install-Chocolatey
    choco install nodejs-lts -y
    refreshenv
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# 安装 pnpm
function Install-Pnpm {
    Write-Info "正在安装 pnpm..."
    npm install -g pnpm
}


# 检查 Python 版本
function Test-Python {
    Write-Info "检查 Python 环境..."
    
    $pythonCmd = $null
    if (Test-Command "python") {
        $pythonCmd = "python"
    } elseif (Test-Command "python3") {
        $pythonCmd = "python3"
    }
    
    if ($pythonCmd) {
        $versionOutput = & $pythonCmd --version 2>&1
        if ($versionOutput -match "(\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -ge 3 -and $minor -ge 10) {
                Write-Success "Python 版本: $versionOutput"
                $script:PythonCmd = $pythonCmd
                return $true
            }
        }
    }
    
    Write-Warn "未找到 Python 3.10+ 版本"
    $choice = Read-Host "是否自动安装 Python 3.11? (y/n)"
    if ($choice -eq "y" -or $choice -eq "Y") {
        Install-Python
        $script:PythonCmd = "python"
        Write-Success "Python 安装完成"
        return $true
    } else {
        Write-Err "请手动安装 Python 3.10+ 后重试"
        exit 1
    }
}

# 检查 Node.js 版本
function Test-NodeJS {
    Write-Info "检查 Node.js 环境..."
    
    if (Test-Command "node") {
        $versionOutput = node --version
        if ($versionOutput -match "v(\d+)") {
            $major = [int]$Matches[1]
            if ($major -ge 18) {
                Write-Success "Node.js 版本: $versionOutput"
                return $true
            }
        }
    }
    
    Write-Warn "未找到 Node.js 18+ 版本"
    $choice = Read-Host "是否自动安装 Node.js LTS? (y/n)"
    if ($choice -eq "y" -or $choice -eq "Y") {
        Install-NodeJS
        Write-Success "Node.js 安装完成"
        return $true
    } else {
        Write-Err "请手动安装 Node.js 18+ 后重试"
        exit 1
    }
}

# 检查 pnpm
function Test-Pnpm {
    Write-Info "检查 pnpm 环境..."
    
    if (Test-Command "pnpm") {
        $version = pnpm --version
        Write-Success "pnpm 版本: $version"
        return $true
    }
    
    Write-Warn "未找到 pnpm"
    $choice = Read-Host "是否自动安装 pnpm? (y/n)"
    if ($choice -eq "y" -or $choice -eq "Y") {
        Install-Pnpm
        Write-Success "pnpm 安装完成"
        return $true
    } else {
        Write-Err "请手动安装 pnpm 后重试"
        exit 1
    }
}

# 配置环境变量
function Set-EnvConfig {
    Write-Info "配置环境变量..."
    
    if (Test-Path $EnvFile) {
        Write-Warn "检测到已存在的 .env 配置文件"
        $reconfigure = Read-Host "是否重新配置? (y/n)"
        if ($reconfigure -ne "y" -and $reconfigure -ne "Y") {
            Write-Info "使用现有配置"
            return
        }
    }
    
    Write-Host ""
    Write-Info "========== MySQL 数据库配置 =========="
    $mysql_host = Read-Host "MySQL 主机地址 [localhost]"
    if ([string]::IsNullOrEmpty($mysql_host)) { $mysql_host = "localhost" }
    
    $mysql_port = Read-Host "MySQL 端口 [3306]"
    if ([string]::IsNullOrEmpty($mysql_port)) { $mysql_port = "3306" }
    
    $mysql_user = Read-Host "MySQL 用户名 [root]"
    if ([string]::IsNullOrEmpty($mysql_user)) { $mysql_user = "root" }
    
    $mysql_password = Read-Host "MySQL 密码" -AsSecureString
    $mysql_password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($mysql_password))
    
    $mysql_database = Read-Host "MySQL 数据库名 [quant_trading]"
    if ([string]::IsNullOrEmpty($mysql_database)) { $mysql_database = "quant_trading" }
    
    Write-Host ""
    Write-Info "========== Redis 配置 =========="
    $redis_host = Read-Host "Redis 主机地址 [localhost]"
    if ([string]::IsNullOrEmpty($redis_host)) { $redis_host = "localhost" }
    
    $redis_port = Read-Host "Redis 端口 [6379]"
    if ([string]::IsNullOrEmpty($redis_port)) { $redis_port = "6379" }
    
    $redis_db = Read-Host "Redis 数据库编号 [0]"
    if ([string]::IsNullOrEmpty($redis_db)) { $redis_db = "0" }
    
    $redis_password = Read-Host "Redis 密码 (无密码直接回车)"
    
    Write-Host ""
    Write-Info "========== 其他配置 (可选) =========="
    $admin_key = Read-Host "管理员密钥 [admin123]"
    if ([string]::IsNullOrEmpty($admin_key)) { $admin_key = "admin123" }
    
    # 生成 .env 文件
    $envContent = @"
# 应用配置
DEBUG=true
SQL_ECHO=false

# MySQL数据库配置
MYSQL_HOST=$mysql_host
MYSQL_PORT=$mysql_port
MYSQL_USER=$mysql_user
MYSQL_PASSWORD=$mysql_password
MYSQL_DATABASE=$mysql_database

# Redis配置
REDIS_HOST=$redis_host
REDIS_PORT=$redis_port
REDIS_DB=$redis_db
REDIS_PASSWORD=$redis_password

# LLM配置
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=your_api_key
LLM_MODEL=gpt-4

# 交易配置
DEFAULT_INITIAL_CASH=20000.0
COMMISSION_RATE=0.0003
STAMP_TAX_RATE=0.001
TRANSFER_FEE_RATE=0.00002

# 数据源配置
DATA_SOURCE=akshare
TUSHARE_API_TOKEN=

# 管理员认证配置
ADMIN_SECRET_KEY=$admin_key
"@
    
    $envContent | Out-File -FilePath $EnvFile -Encoding utf8 -NoNewline
    Write-Success ".env 配置文件已创建: $EnvFile"
}


# 测试 MySQL 连接
function Test-MySQLConnection {
    Write-Info "测试 MySQL 连接..."
    
    if (-not (Test-Command "mysql")) {
        Write-Warn "mysql 客户端未安装，跳过连接测试"
        Write-Warn "请确保 MySQL 服务正在运行且配置正确"
        return
    }
    
    # 读取配置
    $envVars = Get-Content $EnvFile | Where-Object { $_ -match "=" } | ForEach-Object {
        $parts = $_ -split "=", 2
        @{ $parts[0].Trim() = $parts[1].Trim() }
    }
    
    Write-Warn "请手动验证 MySQL 连接是否正常"
}

# 测试 Redis 连接
function Test-RedisConnection {
    Write-Info "测试 Redis 连接..."
    
    if (-not (Test-Command "redis-cli")) {
        Write-Warn "redis-cli 未安装，跳过连接测试"
        Write-Warn "请确保 Redis 服务正在运行且配置正确"
        return
    }
    
    Write-Warn "请手动验证 Redis 连接是否正常"
}

# 安装后端依赖
function Setup-Backend {
    Write-Info "配置后端环境..."
    Push-Location $BackendDir
    
    try {
        # 创建虚拟环境
        $venvPath = Join-Path $BackendDir "venv"
        if (-not (Test-Path $venvPath)) {
            Write-Info "创建 Python 虚拟环境..."
            & $script:PythonCmd -m venv venv
        }
        
        # 激活虚拟环境并安装依赖
        Write-Info "安装后端依赖..."
        $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
        & $activateScript
        
        pip install --upgrade pip
        pip install -e .
        
        Write-Success "后端环境配置完成"
    } finally {
        Pop-Location
    }
}

# 安装前端依赖
function Setup-Frontend {
    Write-Info "配置前端环境..."
    Push-Location $FrontendDir
    
    try {
        Write-Info "安装前端依赖..."
        pnpm install
        Write-Success "前端环境配置完成"
    } finally {
        Pop-Location
    }
}

# 启动后端服务
function Start-Backend {
    Write-Info "启动后端服务..."
    Push-Location $BackendDir
    
    try {
        # 检查是否已有后端进程在运行
        $existingProcess = Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*uvicorn*app.main*"
        }
        
        if ($existingProcess) {
            Write-Warn "后端服务已在运行"
            $restart = Read-Host "是否重启? (y/n)"
            if ($restart -eq "y" -or $restart -eq "Y") {
                $existingProcess | Stop-Process -Force
                Start-Sleep -Seconds 2
            } else {
                return
            }
        }
        
        # 启动后端
        $venvPath = Join-Path $BackendDir "venv"
        $pythonExe = Join-Path $venvPath "Scripts\python.exe"
        
        $backendLog = Join-Path $ScriptDir "backend.log"
        $process = Start-Process -FilePath $pythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload" -WorkingDirectory $BackendDir -RedirectStandardOutput $backendLog -RedirectStandardError $backendLog -PassThru -WindowStyle Hidden
        
        $process.Id | Out-File -FilePath (Join-Path $ScriptDir ".backend.pid") -NoNewline
        
        Start-Sleep -Seconds 3
        if (-not $process.HasExited) {
            Write-Success "后端服务已启动 (PID: $($process.Id))"
            Write-Info "后端地址: http://localhost:8000"
            Write-Info "API 文档: http://localhost:8000/docs"
        } else {
            Write-Err "后端服务启动失败，请查看日志: $backendLog"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# 启动前端服务
function Start-Frontend {
    Write-Info "启动前端服务..."
    Push-Location $FrontendDir
    
    try {
        # 检查是否已有前端进程在运行
        $existingProcess = Get-Process -Name "node*" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*vite*"
        }
        
        if ($existingProcess) {
            Write-Warn "前端服务已在运行"
            $restart = Read-Host "是否重启? (y/n)"
            if ($restart -eq "y" -or $restart -eq "Y") {
                $existingProcess | Stop-Process -Force
                Start-Sleep -Seconds 2
            } else {
                return
            }
        }
        
        # 启动前端
        $frontendLog = Join-Path $ScriptDir "frontend.log"
        $process = Start-Process -FilePath "pnpm" -ArgumentList "dev", "--host" -WorkingDirectory $FrontendDir -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendLog -PassThru -WindowStyle Hidden
        
        $process.Id | Out-File -FilePath (Join-Path $ScriptDir ".frontend.pid") -NoNewline
        
        Start-Sleep -Seconds 5
        if (-not $process.HasExited) {
            Write-Success "前端服务已启动 (PID: $($process.Id))"
            Write-Info "前端地址: http://localhost:5173"
        } else {
            Write-Err "前端服务启动失败，请查看日志: $frontendLog"
            exit 1
        }
    } finally {
        Pop-Location
    }
}

# 停止所有服务
function Stop-Services {
    Write-Info "停止所有服务..."
    
    # 停止后端
    $backendPidFile = Join-Path $ScriptDir ".backend.pid"
    if (Test-Path $backendPidFile) {
        $pid = Get-Content $backendPidFile
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Remove-Item $backendPidFile -Force
    }
    Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*uvicorn*app.main*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # 停止前端
    $frontendPidFile = Join-Path $ScriptDir ".frontend.pid"
    if (Test-Path $frontendPidFile) {
        $pid = Get-Content $frontendPidFile
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Remove-Item $frontendPidFile -Force
    }
    Get-Process -Name "node*" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*vite*"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Write-Success "所有服务已停止"
}

# 显示服务状态
function Show-Status {
    Write-Host ""
    Write-Info "========== 服务状态 =========="
    
    $backendRunning = Get-Process -Name "python*" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*uvicorn*app.main*"
    }
    if ($backendRunning) {
        Write-Success "后端服务: 运行中"
    } else {
        Write-Warn "后端服务: 未运行"
    }
    
    $frontendRunning = Get-Process -Name "node*" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -like "*vite*"
    }
    if ($frontendRunning) {
        Write-Success "前端服务: 运行中"
    } else {
        Write-Warn "前端服务: 未运行"
    }
    Write-Host ""
}

# 显示帮助信息
function Show-Help {
    Write-Host ""
    Write-Host "AI交易竞技场模拟平台 - 部署脚本 (Windows)"
    Write-Host ""
    Write-Host "用法: .\deploy.ps1 [命令]"
    Write-Host ""
    Write-Host "命令:"
    Write-Host "  start     启动所有服务 (默认)"
    Write-Host "  stop      停止所有服务"
    Write-Host "  restart   重启所有服务"
    Write-Host "  status    查看服务状态"
    Write-Host "  config    重新配置环境变量"
    Write-Host "  help      显示帮助信息"
    Write-Host ""
}


# 主函数
function Main {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════════╗"
    Write-Host "║       AI交易竞技场模拟平台 - 一键部署脚本 (Windows)        ║"
    Write-Host "╚══════════════════════════════════════════════════════════╝"
    Write-Host ""
    
    switch ($Command) {
        "start" {
            Test-Python
            Test-NodeJS
            Test-Pnpm
            Set-EnvConfig
            Test-MySQLConnection
            Test-RedisConnection
            Setup-Backend
            Setup-Frontend
            Start-Backend
            Start-Frontend
            Show-Status
            
            Write-Host ""
            Write-Success "🎉 部署完成!"
            Write-Host ""
            Write-Info "前端地址: http://localhost:5173"
            Write-Info "后端地址: http://localhost:8000"
            Write-Info "API 文档: http://localhost:8000/docs"
            Write-Host ""
            Write-Info "查看日志:"
            Write-Info "  后端日志: Get-Content $ScriptDir\backend.log -Wait"
            Write-Info "  前端日志: Get-Content $ScriptDir\frontend.log -Wait"
            Write-Host ""
            Write-Info "停止服务: .\deploy.ps1 stop"
            Write-Host ""
        }
        "stop" {
            Stop-Services
        }
        "restart" {
            Stop-Services
            Start-Sleep -Seconds 2
            & $MyInvocation.MyCommand.Path -Command "start"
        }
        "status" {
            Show-Status
        }
        "config" {
            Set-EnvConfig
            Test-MySQLConnection
            Test-RedisConnection
        }
        "help" {
            Show-Help
        }
    }
}

# 运行主函数
Main
