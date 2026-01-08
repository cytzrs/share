#!/bin/bash
"""启动脚本，加载环境变量并启动应用程序"""

# 加载.env文件中的环境变量
if [ -f .env ]; then
    echo "加载.env文件中的环境变量..."
    export $(grep -v '^#' .env | xargs)
    echo "环境变量加载完成！"
else
    echo "警告：.env文件不存在，使用默认环境变量..."
fi

# 启动应用程序
echo "启动应用程序..."
python -m app.main