"""MCP数据仓库

提供MCP服务的CRUD操作、搜索过滤和统计查询
"""

from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.db.models import MCPServerModel, MCPConnectionModel, MCPToolModel
from app.api.schemas import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPConnectionCreate,
    MCPToolCreate,
)


class MCPRepository:
    """MCP数据仓库类"""

    def __init__(self, db: Session):
        """初始化仓库
        
        Args:
            db: 数据库会话
        """
        self.db = db

    def find_all(
        self,
        filters: Optional[Dict[str, Any]] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[MCPServerModel], int]:
        """获取MCP服务列表
        
        Args:
            filters: 过滤条件
            page: 页码
            page_size: 每页数量
            
        Returns:
            (服务列表, 总数)
        """
        query = self.db.query(MCPServerModel).filter(
            MCPServerModel.is_deleted == 0
        )

        # 应用过滤条件
        if filters:
            # server_id 精确搜索
            if filters.get("server_id"):
                query = query.filter(MCPServerModel.server_id == filters["server_id"])
            
            # display_name 模糊搜索
            if filters.get("display_name"):
                query = query.filter(
                    MCPServerModel.display_name.like(f"%{filters['display_name']}%")
                )
            
            # description 模糊搜索
            if filters.get("description"):
                query = query.filter(
                    MCPServerModel.description.like(f"%{filters['description']}%")
                )
            
            # 关键词搜索（同时搜索 display_name 和 description）
            if filters.get("keyword"):
                keyword = f"%{filters['keyword']}%"
                query = query.filter(
                    or_(
                        MCPServerModel.display_name.like(keyword),
                        MCPServerModel.description.like(keyword),
                        MCPServerModel.qualified_name.like(keyword),
                    )
                )
            
            # status 状态过滤
            if filters.get("status") is not None:
                if filters["status"] == "enabled":
                    query = query.filter(MCPServerModel.is_enabled == 1)
                elif filters["status"] == "disabled":
                    query = query.filter(MCPServerModel.is_enabled == 0)
            
            # type 类型过滤
            if filters.get("type"):
                query = query.filter(MCPServerModel.type == filters["type"])

        # 获取总数
        total = query.count()

        # 分页和排序
        offset = (page - 1) * page_size
        servers = (
            query.order_by(MCPServerModel.created_at.desc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        return servers, total

    def find_by_id(self, server_id: int) -> Optional[MCPServerModel]:
        """根据ID获取MCP服务
        
        Args:
            server_id: 服务ID
            
        Returns:
            MCP服务模型或None
        """
        return (
            self.db.query(MCPServerModel)
            .filter(
                and_(
                    MCPServerModel.server_id == server_id,
                    MCPServerModel.is_deleted == 0,
                )
            )
            .first()
        )

    def find_by_qualified_name(self, qualified_name: str) -> Optional[MCPServerModel]:
        """根据唯一标识名获取MCP服务
        
        Args:
            qualified_name: 唯一标识名
            
        Returns:
            MCP服务模型或None
        """
        return (
            self.db.query(MCPServerModel)
            .filter(
                and_(
                    MCPServerModel.qualified_name == qualified_name,
                    MCPServerModel.is_deleted == 0,
                )
            )
            .first()
        )

    def create(self, data: MCPServerCreate) -> MCPServerModel:
        """创建MCP服务
        
        Args:
            data: 创建请求数据
            
        Returns:
            创建的MCP服务模型
        """
        # 创建服务主记录
        server = MCPServerModel(
            qualified_name=data.qualified_name,
            display_name=data.display_name,
            description=data.description,
            logo=data.logo,
            creator=data.creator,
            type=data.type,
            tag=data.tag,
            introduction=data.introduction,
            is_domestic=1 if data.is_domestic else 0,
            package_url=data.package_url,
            repository_id=data.repository_id,
            use_count=0,
            is_enabled=1,
            is_deleted=0,
        )
        self.db.add(server)
        self.db.flush()  # 获取 server_id

        # 创建连接配置
        for conn_data in data.connections:
            connection = MCPConnectionModel(
                server_id=server.server_id,
                connection_type=conn_data.connection_type,
                command=conn_data.command,
                args=conn_data.args,
                env=conn_data.env,
            )
            self.db.add(connection)

        # 创建工具定义
        for tool_data in data.tools:
            tool = MCPToolModel(
                server_id=server.server_id,
                name=tool_data.name,
                description=tool_data.description,
                input_schema=tool_data.input_schema,
                translation=tool_data.translation,
            )
            self.db.add(tool)

        self.db.commit()
        self.db.refresh(server)
        return server

    def update(self, server_id: int, data: MCPServerUpdate) -> Optional[MCPServerModel]:
        """更新MCP服务
        
        Args:
            server_id: 服务ID
            data: 更新请求数据
            
        Returns:
            更新后的MCP服务模型或None
        """
        server = self.find_by_id(server_id)
        if not server:
            return None

        # 更新基础字段（排除 use_count 和 created_at）
        update_fields = [
            "display_name", "description", "logo", "creator", "type",
            "tag", "introduction", "package_url", "repository_id"
        ]
        
        for field in update_fields:
            value = getattr(data, field, None)
            if value is not None:
                setattr(server, field, value)
        
        # 特殊处理 is_domestic
        if data.is_domestic is not None:
            server.is_domestic = 1 if data.is_domestic else 0

        # 更新连接配置（如果提供）
        if data.connections is not None:
            # 删除旧的连接配置
            self.db.query(MCPConnectionModel).filter(
                MCPConnectionModel.server_id == server_id
            ).delete()
            
            # 创建新的连接配置
            for conn_data in data.connections:
                connection = MCPConnectionModel(
                    server_id=server_id,
                    connection_type=conn_data.connection_type,
                    command=conn_data.command,
                    args=conn_data.args,
                    env=conn_data.env,
                )
                self.db.add(connection)

        # 更新工具定义（如果提供）
        if data.tools is not None:
            # 删除旧的工具定义
            self.db.query(MCPToolModel).filter(
                MCPToolModel.server_id == server_id
            ).delete()
            
            # 创建新的工具定义
            for tool_data in data.tools:
                tool = MCPToolModel(
                    server_id=server_id,
                    name=tool_data.name,
                    description=tool_data.description,
                    input_schema=tool_data.input_schema,
                    translation=tool_data.translation,
                )
                self.db.add(tool)

        self.db.commit()
        self.db.refresh(server)
        return server

    def delete(self, server_id: int) -> bool:
        """软删除MCP服务
        
        Args:
            server_id: 服务ID
            
        Returns:
            是否删除成功
        """
        server = self.find_by_id(server_id)
        if not server:
            return False

        server.is_deleted = 1
        self.db.commit()
        return True

    def hard_delete(self, server_id: int) -> bool:
        """硬删除MCP服务（级联删除连接和工具）
        
        Args:
            server_id: 服务ID
            
        Returns:
            是否删除成功
        """
        server = self.db.query(MCPServerModel).filter(
            MCPServerModel.server_id == server_id
        ).first()
        
        if not server:
            return False

        self.db.delete(server)
        self.db.commit()
        return True

    def update_status(self, server_id: int, is_enabled: bool) -> Optional[MCPServerModel]:
        """更新MCP服务状态
        
        Args:
            server_id: 服务ID
            is_enabled: 是否启用
            
        Returns:
            更新后的MCP服务模型或None
        """
        server = self.find_by_id(server_id)
        if not server:
            return None

        server.is_enabled = 1 if is_enabled else 0
        self.db.commit()
        self.db.refresh(server)
        return server

    def increment_use_count(self, server_id: int) -> bool:
        """增加使用次数
        
        Args:
            server_id: 服务ID
            
        Returns:
            是否成功
        """
        result = (
            self.db.query(MCPServerModel)
            .filter(
                and_(
                    MCPServerModel.server_id == server_id,
                    MCPServerModel.is_deleted == 0,
                )
            )
            .update({MCPServerModel.use_count: MCPServerModel.use_count + 1})
        )
        self.db.commit()
        return result > 0

    def get_stats(self) -> Dict[str, int]:
        """获取生态统计数据
        
        Returns:
            统计数据字典
        """
        # 总服务数量（非删除）
        total_servers = (
            self.db.query(func.count(MCPServerModel.server_id))
            .filter(MCPServerModel.is_deleted == 0)
            .scalar()
        ) or 0

        # 启用服务数量
        enabled_servers = (
            self.db.query(func.count(MCPServerModel.server_id))
            .filter(
                and_(
                    MCPServerModel.is_deleted == 0,
                    MCPServerModel.is_enabled == 1,
                )
            )
            .scalar()
        ) or 0

        # 总调用量
        total_use_count = (
            self.db.query(func.sum(MCPServerModel.use_count))
            .filter(MCPServerModel.is_deleted == 0)
            .scalar()
        ) or 0

        return {
            "total_servers": total_servers,
            "enabled_servers": enabled_servers,
            "total_use_count": total_use_count,
        }

    def get_tool_by_name(
        self, server_id: int, tool_name: str
    ) -> Optional[MCPToolModel]:
        """根据服务ID和工具名称获取工具
        
        Args:
            server_id: 服务ID
            tool_name: 工具名称
            
        Returns:
            工具模型或None
        """
        return (
            self.db.query(MCPToolModel)
            .filter(
                and_(
                    MCPToolModel.server_id == server_id,
                    MCPToolModel.name == tool_name,
                )
            )
            .first()
        )
