"""
MCP服务模块

提供MCP服务的创建、更新、删除、状态管理、统计和工具测试功能。

实现需求:
- 2.1-2.5: MCP服务创建
- 3.1-3.4: MCP服务编辑
- 4.2-4.3: MCP服务删除
- 5.1-5.4: MCP服务启停用
- 6.2, 6.5: MCP工具测试
- 10.1-10.3: 生态统计数据
"""

import logging
import time
from typing import Optional, List, Dict, Any, Tuple

from sqlalchemy.orm import Session

from app.db.models import MCPServerModel, MCPToolModel
from app.db.mcp_repository import MCPRepository
from app.api.schemas import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPServerResponse,
    MCPConnectionResponse,
    MCPToolResponse,
    MCPStatsResponse,
    MCPToolTestResponse,
)

logger = logging.getLogger(__name__)


class MCPServiceError(Exception):
    """MCP服务错误基类"""
    pass


class MCPServerNotFoundError(MCPServiceError):
    """MCP服务不存在错误"""
    pass


class MCPToolNotFoundError(MCPServiceError):
    """MCP工具不存在错误"""
    pass


class MCPServerDisabledError(MCPServiceError):
    """MCP服务已禁用错误"""
    pass


class MCPNameDuplicateError(MCPServiceError):
    """MCP名称重复错误"""
    pass


class MCPValidationError(MCPServiceError):
    """MCP验证错误"""
    pass


class MCPService:
    """
    MCP服务类
    
    提供MCP服务的CRUD操作、状态管理、统计和工具测试功能。
    """
    
    def __init__(self, db: Session):
        """
        初始化MCP服务
        
        Args:
            db: 数据库会话
        """
        self.db = db
        self.repository = MCPRepository(db)
    
    def list_servers(
        self,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[MCPServerResponse], int]:
        """
        获取MCP服务列表
        
        Args:
            filters: 过滤条件
            page: 页码
            page_size: 每页数量
            
        Returns:
            (服务响应列表, 总数)
        """
        servers, total = self.repository.find_all(filters, page, page_size)
        
        responses = [self._to_response(server) for server in servers]
        return responses, total
    
    def get_server(self, server_id: int) -> MCPServerResponse:
        """
        获取MCP服务详情
        
        Args:
            server_id: 服务ID
            
        Returns:
            MCP服务响应
            
        Raises:
            MCPServerNotFoundError: 当服务不存在时
        """
        server = self.repository.find_by_id(server_id)
        if not server:
            raise MCPServerNotFoundError(f"MCP服务不存在: {server_id}")
        
        return self._to_response(server)
    
    def create_server(self, data: MCPServerCreate) -> MCPServerResponse:
        """
        创建MCP服务
        
        Args:
            data: 创建请求数据
            
        Returns:
            创建的MCP服务响应
            
        Raises:
            MCPNameDuplicateError: 当qualified_name已存在时
            MCPValidationError: 当验证失败时
        """
        # 验证必填字段
        if not data.qualified_name or not data.qualified_name.strip():
            raise MCPValidationError("qualified_name不能为空")
        if not data.display_name or not data.display_name.strip():
            raise MCPValidationError("display_name不能为空")
        
        # 检查qualified_name是否已存在
        existing = self.repository.find_by_qualified_name(data.qualified_name)
        if existing:
            raise MCPNameDuplicateError(f"qualified_name已存在: {data.qualified_name}")
        
        # 创建服务
        server = self.repository.create(data)
        
        logger.info(f"MCP服务创建成功: {server.display_name} (ID: {server.server_id})")
        return self._to_response(server)
    
    def update_server(self, server_id: int, data: MCPServerUpdate) -> MCPServerResponse:
        """
        更新MCP服务
        
        Args:
            server_id: 服务ID
            data: 更新请求数据
            
        Returns:
            更新后的MCP服务响应
            
        Raises:
            MCPServerNotFoundError: 当服务不存在时
        """
        # 检查服务是否存在
        existing = self.repository.find_by_id(server_id)
        if not existing:
            raise MCPServerNotFoundError(f"MCP服务不存在: {server_id}")
        
        # 记录更新前的use_count和created_at
        original_use_count = existing.use_count
        original_created_at = existing.created_at
        
        # 更新服务
        server = self.repository.update(server_id, data)
        
        # 验证use_count和created_at未被修改（由repository保证）
        if server.use_count != original_use_count:
            logger.warning(f"use_count被意外修改: {original_use_count} -> {server.use_count}")
        if server.created_at != original_created_at:
            logger.warning(f"created_at被意外修改: {original_created_at} -> {server.created_at}")
        
        logger.info(f"MCP服务更新成功: {server.display_name} (ID: {server.server_id})")
        return self._to_response(server)
    
    def delete_server(self, server_id: int) -> bool:
        """
        删除MCP服务（软删除）
        
        Args:
            server_id: 服务ID
            
        Returns:
            是否删除成功
            
        Raises:
            MCPServerNotFoundError: 当服务不存在时
        """
        # 检查服务是否存在
        existing = self.repository.find_by_id(server_id)
        if not existing:
            raise MCPServerNotFoundError(f"MCP服务不存在: {server_id}")
        
        # 软删除
        result = self.repository.delete(server_id)
        
        if result:
            logger.info(f"MCP服务删除成功: {existing.display_name} (ID: {server_id})")
        
        return result
    
    def toggle_status(self, server_id: int, is_enabled: bool) -> MCPServerResponse:
        """
        切换MCP服务状态
        
        Args:
            server_id: 服务ID
            is_enabled: 是否启用
            
        Returns:
            更新后的MCP服务响应
            
        Raises:
            MCPServerNotFoundError: 当服务不存在时
        """
        # 检查服务是否存在
        existing = self.repository.find_by_id(server_id)
        if not existing:
            raise MCPServerNotFoundError(f"MCP服务不存在: {server_id}")
        
        # 更新状态
        server = self.repository.update_status(server_id, is_enabled)
        
        status_text = "启用" if is_enabled else "禁用"
        logger.info(f"MCP服务状态更新: {server.display_name} -> {status_text} (ID: {server_id})")
        
        return self._to_response(server)
    
    def get_stats(self) -> MCPStatsResponse:
        """
        获取生态统计数据
        
        Returns:
            统计数据响应
        """
        stats = self.repository.get_stats()
        
        return MCPStatsResponse(
            total_servers=stats["total_servers"],
            enabled_servers=stats["enabled_servers"],
            total_use_count=stats["total_use_count"],
        )
    
    def test_tool(
        self,
        server_id: int,
        tool_name: str,
        arguments: Dict[str, Any],
    ) -> MCPToolTestResponse:
        """
        测试MCP工具
        
        Args:
            server_id: 服务ID
            tool_name: 工具名称
            arguments: 工具参数
            
        Returns:
            工具测试响应
            
        Raises:
            MCPServerNotFoundError: 当服务不存在时
            MCPToolNotFoundError: 当工具不存在时
            MCPServerDisabledError: 当服务已禁用时
        """
        # 检查服务是否存在
        server = self.repository.find_by_id(server_id)
        if not server:
            raise MCPServerNotFoundError(f"MCP服务不存在: {server_id}")
        
        # 检查服务是否启用
        if not server.is_enabled:
            raise MCPServerDisabledError(f"MCP服务已禁用: {server_id}")
        
        # 检查工具是否存在
        tool = self.repository.get_tool_by_name(server_id, tool_name)
        if not tool:
            raise MCPToolNotFoundError(f"MCP工具不存在: {tool_name}")
        
        # 执行工具测试
        start_time = time.time()
        try:
            # 实际的MCP工具调用逻辑
            # 这里是模拟实现，实际需要根据连接配置调用MCP服务
            result = self._execute_tool(server, tool, arguments)
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 增加使用次数
            self.repository.increment_use_count(server_id)
            
            logger.info(f"MCP工具测试成功: {server.display_name}/{tool_name} (耗时: {duration_ms}ms)")
            
            return MCPToolTestResponse(
                success=True,
                result=result,
                duration_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_message = str(e)
            
            logger.error(f"MCP工具测试失败: {server.display_name}/{tool_name} - {error_message}")
            
            return MCPToolTestResponse(
                success=False,
                error_message=error_message,
                duration_ms=duration_ms,
            )
    
    def _execute_tool(
        self,
        server: MCPServerModel,
        tool: MCPToolModel,
        arguments: Dict[str, Any],
    ) -> Any:
        """
        执行MCP工具
        
        Args:
            server: MCP服务模型
            tool: MCP工具模型
            arguments: 工具参数
            
        Returns:
            执行结果
        """
        # 获取连接配置
        if not server.connections:
            raise MCPServiceError("MCP服务没有配置连接方式")
        
        connection = server.connections[0]  # 使用第一个连接配置
        
        # 根据连接类型执行
        if connection.connection_type == "stdio":
            return self._execute_stdio_tool(connection, tool, arguments)
        elif connection.connection_type == "http":
            return self._execute_http_tool(connection, tool, arguments)
        elif connection.connection_type == "sse":
            return self._execute_sse_tool(connection, tool, arguments)
        else:
            raise MCPServiceError(f"不支持的连接类型: {connection.connection_type}")
    
    def _execute_stdio_tool(
        self,
        connection,
        tool: MCPToolModel,
        arguments: Dict[str, Any],
    ) -> Any:
        """
        通过stdio执行MCP工具
        
        这是一个模拟实现，实际需要：
        1. 启动MCP服务进程
        2. 通过stdin/stdout进行JSON-RPC通信
        3. 调用工具并获取结果
        """
        # 模拟返回结果
        return {
            "tool": tool.name,
            "arguments": arguments,
            "message": f"Tool '{tool.name}' executed successfully (simulated)",
        }
    
    def _execute_http_tool(
        self,
        connection,
        tool: MCPToolModel,
        arguments: Dict[str, Any],
    ) -> Any:
        """
        通过HTTP执行MCP工具
        
        这是一个模拟实现，实际需要：
        1. 构建HTTP请求
        2. 发送到MCP服务端点
        3. 解析响应
        """
        return {
            "tool": tool.name,
            "arguments": arguments,
            "message": f"Tool '{tool.name}' executed via HTTP (simulated)",
        }
    
    def _execute_sse_tool(
        self,
        connection,
        tool: MCPToolModel,
        arguments: Dict[str, Any],
    ) -> Any:
        """
        通过SSE执行MCP工具
        
        这是一个模拟实现
        """
        return {
            "tool": tool.name,
            "arguments": arguments,
            "message": f"Tool '{tool.name}' executed via SSE (simulated)",
        }
    
    def _to_response(self, server: MCPServerModel) -> MCPServerResponse:
        """
        将模型转换为响应对象
        
        Args:
            server: MCP服务模型
            
        Returns:
            MCP服务响应
        """
        connections = [
            MCPConnectionResponse(
                connection_id=conn.connection_id,
                connection_type=conn.connection_type,
                command=conn.command,
                args=conn.args,
                env=conn.env,
            )
            for conn in server.connections
        ]
        
        tools = [
            MCPToolResponse(
                tool_id=tool.tool_id,
                name=tool.name,
                description=tool.description,
                input_schema=tool.input_schema,
                translation=tool.translation,
            )
            for tool in server.tools
        ]
        
        return MCPServerResponse(
            server_id=server.server_id,
            qualified_name=server.qualified_name,
            display_name=server.display_name,
            description=server.description,
            logo=server.logo,
            creator=server.creator,
            type=server.type,
            tag=server.tag,
            introduction=server.introduction,
            is_domestic=bool(server.is_domestic),
            package_url=server.package_url,
            repository_id=server.repository_id,
            use_count=server.use_count,
            is_enabled=bool(server.is_enabled),
            created_at=server.created_at,
            updated_at=server.updated_at,
            connections=connections,
            tools=tools,
        )
    
    def get_all_tools_markdown(self) -> str:
        """
        获取所有MCP服务及工具信息，格式化为Markdown
        
        用于提示词占位符 {{mcp_tools}}
        
        Returns:
            Markdown格式的MCP工具列表
        """
        # 获取所有启用的MCP服务
        servers, _ = self.repository.find_all(
            filters={"status": "enabled"},
            page=1,
            page_size=1000,  # 获取所有
        )
        
        if not servers:
            return "暂无可用的MCP工具"
        
        lines = ["## 可用MCP工具列表\n"]
        
        for server in servers:
            # 服务标题
            lines.append(f"### {server.display_name}")
            if server.description:
                lines.append(f"*{server.description}*\n")
            else:
                lines.append("")
            
            # 服务信息
            if server.creator:
                lines.append(f"- **提供者**: {server.creator}")
            if server.tag:
                lines.append(f"- **标签**: {server.tag}")
            lines.append("")
            
            # 工具列表
            if server.tools:
                lines.append("**工具列表:**\n")
                for tool in server.tools:
                    tool_name = tool.translation if tool.translation else tool.name
                    lines.append(f"#### {tool_name} (`{tool.name}`)")
                    if tool.description:
                        lines.append(f"{tool.description}\n")
                    
                    # 输入参数
                    if tool.input_schema:
                        lines.append("**参数:**")
                        self._format_input_schema(tool.input_schema, lines)
                    lines.append("")
            else:
                lines.append("*该服务暂无工具定义*\n")
            
            lines.append("---\n")
        
        return "\n".join(lines)
    
    def _format_input_schema(self, schema: Dict[str, Any], lines: List[str], indent: int = 0) -> None:
        """
        格式化输入参数Schema为Markdown
        
        Args:
            schema: JSON Schema
            lines: 输出行列表
            indent: 缩进级别
        """
        prefix = "  " * indent
        
        if not isinstance(schema, dict):
            return
        
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        
        if not properties:
            # 如果没有properties，尝试直接显示schema
            if schema.get("type"):
                lines.append(f"{prefix}- 类型: `{schema.get('type')}`")
            return
        
        for prop_name, prop_schema in properties.items():
            is_required = prop_name in required
            required_mark = " *(必填)*" if is_required else ""
            prop_type = prop_schema.get("type", "any")
            prop_desc = prop_schema.get("description", "")
            
            if prop_desc:
                lines.append(f"{prefix}- `{prop_name}` ({prop_type}){required_mark}: {prop_desc}")
            else:
                lines.append(f"{prefix}- `{prop_name}` ({prop_type}){required_mark}")
