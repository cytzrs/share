#!/bin/bash

# AI交易竞技场模拟平台 - 一键部署脚本
# 支持 macOS 和 Linux

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
ENV_FILE="$BACKEND_DIR/.env"

# 检测操作系统
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    else
        print_error "不支持的操作系统: $OSTYPE"
        exit 1
    fi
    print_info "检测到操作系统: $OS"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" &> /dev/null
}

# 安装 Homebrew (macOS)
install_homebrew() {
    if ! command_exists brew; then
        print_info "正在安装 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # 添加到 PATH
        if [[ "$OS" == "macos" ]]; then
            if [[ -f "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f "/usr/local/bin/brew" ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
        fi
    fi
}

# 安装 Python
install_python() {
    print_info "正在安装 Python..."
    if [[ "$OS" == "macos" ]]; then
        install_homebrew
        brew install python@3.11
    else
        sudo apt-get update
        sudo apt-get install -y python3.11 python3.11-venv python3-pip
    fi
}

# 安装 Node.js
install_nodejs() {
    print_info "正在安装 Node.js..."
    if [[ "$OS" == "macos" ]]; then
        install_homebrew
        brew install node@20
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
}

# 安装 pnpm
install_pnpm() {
    print_info "正在安装 pnpm..."
    npm install -g pnpm
}


# 检查 Python 版本
check_python() {
    print_info "检查 Python 环境..."
    
    local python_cmd=""
    if command_exists python3; then
        python_cmd="python3"
    elif command_exists python; then
        python_cmd="python"
    fi
    
    if [[ -n "$python_cmd" ]]; then
        local version=$($python_cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
        local major=$(echo $version | cut -d. -f1)
        local minor=$(echo $version | cut -d. -f2)
        
        if [[ "$major" -ge 3 && "$minor" -ge 10 ]]; then
            print_success "Python 版本: $($python_cmd --version)"
            PYTHON_CMD=$python_cmd
            return 0
        fi
    fi
    
    print_warning "未找到 Python 3.10+ 版本"
    read -p "是否自动安装 Python 3.11? (y/n): " install_choice
    if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
        install_python
        PYTHON_CMD="python3"
        print_success "Python 安装完成"
    else
        print_error "请手动安装 Python 3.10+ 后重试"
        exit 1
    fi
}

# 检查 Node.js 版本
check_nodejs() {
    print_info "检查 Node.js 环境..."
    
    if command_exists node; then
        local version=$(node --version | grep -oE '[0-9]+' | head -1)
        if [[ "$version" -ge 18 ]]; then
            print_success "Node.js 版本: $(node --version)"
            return 0
        fi
    fi
    
    print_warning "未找到 Node.js 18+ 版本"
    read -p "是否自动安装 Node.js 20? (y/n): " install_choice
    if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
        install_nodejs
        print_success "Node.js 安装完成"
    else
        print_error "请手动安装 Node.js 18+ 后重试"
        exit 1
    fi
}

# 检查 pnpm
check_pnpm() {
    print_info "检查 pnpm 环境..."
    
    if command_exists pnpm; then
        print_success "pnpm 版本: $(pnpm --version)"
        return 0
    fi
    
    print_warning "未找到 pnpm"
    read -p "是否自动安装 pnpm? (y/n): " install_choice
    if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
        install_pnpm
        print_success "pnpm 安装完成"
    else
        print_error "请手动安装 pnpm 后重试"
        exit 1
    fi
}

# 配置环境变量
configure_env() {
    print_info "配置环境变量..."
    
    if [[ -f "$ENV_FILE" ]]; then
        print_warning "检测到已存在的 .env 配置文件"
        read -p "是否重新配置? (y/n): " reconfigure
        if [[ "$reconfigure" != "y" && "$reconfigure" != "Y" ]]; then
            print_info "使用现有配置"
            return 0
        fi
    fi
    
    echo ""
    print_info "========== MySQL 数据库配置 =========="
    read -p "MySQL 主机地址 [localhost]: " mysql_host
    mysql_host=${mysql_host:-localhost}
    
    read -p "MySQL 端口 [3306]: " mysql_port
    mysql_port=${mysql_port:-3306}
    
    read -p "MySQL 用户名 [root]: " mysql_user
    mysql_user=${mysql_user:-root}
    
    read -sp "MySQL 密码: " mysql_password
    echo ""
    
    read -p "MySQL 数据库名 [quant_trading]: " mysql_database
    mysql_database=${mysql_database:-quant_trading}
    
    echo ""
    print_info "========== Redis 配置 =========="
    read -p "Redis 主机地址 [localhost]: " redis_host
    redis_host=${redis_host:-localhost}
    
    read -p "Redis 端口 [6379]: " redis_port
    redis_port=${redis_port:-6379}
    
    read -p "Redis 数据库编号 [0]: " redis_db
    redis_db=${redis_db:-0}
    
    read -sp "Redis 密码 (无密码直接回车): " redis_password
    echo ""
    
    echo ""
    print_info "========== 其他配置 (可选) =========="
    read -p "管理员密钥 [admin123]: " admin_key
    admin_key=${admin_key:-admin123}
    
    # 生成 .env 文件
    cat > "$ENV_FILE" << EOF
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
EOF
    
    print_success ".env 配置文件已创建: $ENV_FILE"
}


# 测试数据库连接
test_mysql_connection() {
    print_info "测试 MySQL 连接..."
    
    # 从 .env 读取配置
    source "$ENV_FILE"
    
    if command_exists mysql; then
        if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" &> /dev/null; then
            print_success "MySQL 连接成功"
            
            # 检查数据库是否存在，不存在则创建
            if ! mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "USE $MYSQL_DATABASE" &> /dev/null; then
                print_info "数据库 $MYSQL_DATABASE 不存在，正在创建..."
                mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "CREATE DATABASE $MYSQL_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                print_success "数据库创建成功"
            fi
            return 0
        fi
    fi
    
    print_warning "无法测试 MySQL 连接 (mysql 客户端未安装或连接失败)"
    print_warning "请确保 MySQL 服务正在运行且配置正确"
}

# 测试 Redis 连接
test_redis_connection() {
    print_info "测试 Redis 连接..."
    
    source "$ENV_FILE"
    
    if command_exists redis-cli; then
        local redis_cmd="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
        if [[ -n "$REDIS_PASSWORD" ]]; then
            redis_cmd="$redis_cmd -a $REDIS_PASSWORD"
        fi
        
        if $redis_cmd ping &> /dev/null; then
            print_success "Redis 连接成功"
            return 0
        fi
    fi
    
    print_warning "无法测试 Redis 连接 (redis-cli 未安装或连接失败)"
    print_warning "请确保 Redis 服务正在运行且配置正确"
}

# 安装后端依赖
setup_backend() {
    print_info "配置后端环境..."
    cd "$BACKEND_DIR"
    
    # 创建虚拟环境
    if [[ ! -d "venv" ]]; then
        print_info "创建 Python 虚拟环境..."
        $PYTHON_CMD -m venv venv
    fi
    
    # 激活虚拟环境并安装依赖
    print_info "安装后端依赖..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -e .
    
    print_success "后端环境配置完成"
}

# 安装前端依赖
setup_frontend() {
    print_info "配置前端环境..."
    cd "$FRONTEND_DIR"
    
    print_info "安装前端依赖..."
    pnpm install
    
    print_success "前端环境配置完成"
}

# 启动后端服务
start_backend() {
    print_info "启动后端服务..."
    cd "$BACKEND_DIR"
    
    source venv/bin/activate
    
    # 检查是否已有后端进程在运行
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
        print_warning "后端服务已在运行"
        read -p "是否重启? (y/n): " restart
        if [[ "$restart" == "y" || "$restart" == "Y" ]]; then
            pkill -f "uvicorn app.main:app" || true
            sleep 2
        else
            return 0
        fi
    fi
    
    # 后台启动
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$SCRIPT_DIR/.backend.pid"
    
    sleep 3
    if ps -p $BACKEND_PID > /dev/null; then
        print_success "后端服务已启动 (PID: $BACKEND_PID)"
        print_info "后端地址: http://localhost:8000"
        print_info "API 文档: http://localhost:8000/docs"
    else
        print_error "后端服务启动失败，请查看日志: $SCRIPT_DIR/backend.log"
        exit 1
    fi
}

# 启动前端服务
start_frontend() {
    print_info "启动前端服务..."
    cd "$FRONTEND_DIR"
    
    # 检查是否已有前端进程在运行
    if pgrep -f "vite" > /dev/null; then
        print_warning "前端服务已在运行"
        read -p "是否重启? (y/n): " restart
        if [[ "$restart" == "y" || "$restart" == "Y" ]]; then
            pkill -f "vite" || true
            sleep 2
        else
            return 0
        fi
    fi
    
    # 后台启动
    nohup pnpm dev --host > "$SCRIPT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "$SCRIPT_DIR/.frontend.pid"
    
    sleep 5
    if ps -p $FRONTEND_PID > /dev/null; then
        print_success "前端服务已启动 (PID: $FRONTEND_PID)"
        print_info "前端地址: http://localhost:5173"
    else
        print_error "前端服务启动失败，请查看日志: $SCRIPT_DIR/frontend.log"
        exit 1
    fi
}

# 停止所有服务
stop_services() {
    print_info "停止所有服务..."
    
    if [[ -f "$SCRIPT_DIR/.backend.pid" ]]; then
        kill $(cat "$SCRIPT_DIR/.backend.pid") 2>/dev/null || true
        rm "$SCRIPT_DIR/.backend.pid"
    fi
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    
    if [[ -f "$SCRIPT_DIR/.frontend.pid" ]]; then
        kill $(cat "$SCRIPT_DIR/.frontend.pid") 2>/dev/null || true
        rm "$SCRIPT_DIR/.frontend.pid"
    fi
    pkill -f "vite" 2>/dev/null || true
    
    print_success "所有服务已停止"
}

# 显示服务状态
show_status() {
    echo ""
    print_info "========== 服务状态 =========="
    
    if pgrep -f "uvicorn app.main:app" > /dev/null; then
        print_success "后端服务: 运行中"
    else
        print_warning "后端服务: 未运行"
    fi
    
    if pgrep -f "vite" > /dev/null; then
        print_success "前端服务: 运行中"
    else
        print_warning "前端服务: 未运行"
    fi
    echo ""
}

# 显示帮助信息
show_help() {
    echo ""
    echo "AI交易竞技场模拟平台 - 部署脚本"
    echo ""
    echo "用法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  start     启动所有服务 (默认)"
    echo "  stop      停止所有服务"
    echo "  restart   重启所有服务"
    echo "  status    查看服务状态"
    echo "  config    重新配置环境变量"
    echo "  help      显示帮助信息"
    echo ""
}

load_env() {
    # 加载.env文件中的环境变量
    if [ -f $ENV_FILE ]; then
        echo "加载.env文件中的环境变量..."
        export $(grep -v '^#' $ENV_FILE | xargs)
        echo "环境变量加载完成！"
    else
        echo "警告：.env文件不存在，使用默认环境变量..."
    fi
}


# 主函数
main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║       AI交易竞技场模拟平台 - 一键部署脚本                  ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    
    local command=${1:-start}
    
    case $command in
        start)
            detect_os
            check_python
            check_nodejs
            check_pnpm
            load_env
            configure_env
            test_mysql_connection
            test_redis_connection
            setup_backend
            setup_frontend
            start_backend
            start_frontend
            show_status
            
            echo ""
            print_success "🎉 部署完成!"
            echo ""
            print_info "前端地址: http://localhost:5173"
            print_info "后端地址: http://localhost:8000"
            print_info "API 文档: http://localhost:8000/docs"
            echo ""
            print_info "查看日志:"
            print_info "  后端日志: tail -f $SCRIPT_DIR/backend.log"
            print_info "  前端日志: tail -f $SCRIPT_DIR/frontend.log"
            echo ""
            print_info "停止服务: $0 stop"
            echo ""
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            sleep 2
            exec "$0" start
            ;;
        status)
            show_status
            ;;
        config)
            configure_env
            test_mysql_connection
            test_redis_connection
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
