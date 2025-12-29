"""通用 Repository 基类

提供通用的 CRUD 操作，减少重复代码
"""

from typing import TypeVar, Generic, Type, Optional, List, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_

# 泛型类型变量
ModelType = TypeVar("ModelType")  # SQLAlchemy ORM 模型
EntityType = TypeVar("EntityType")  # 业务实体


class BaseRepository(Generic[ModelType, EntityType]):
    """通用 Repository 基类
    
    提供基础的 CRUD 操作，子类需要实现 _to_entity 方法
    
    Type Parameters:
        ModelType: SQLAlchemy ORM 模型类型
        EntityType: 业务实体类型
    """
    
    def __init__(self, db: Session, model_class: Type[ModelType]):
        """初始化 Repository
        
        Args:
            db: 数据库会话
            model_class: ORM 模型类
        """
        self.db = db
        self.model_class = model_class
    
    def _to_entity(self, model: ModelType) -> EntityType:
        """将 ORM 模型转换为业务实体
        
        子类必须实现此方法
        
        Args:
            model: ORM 模型实例
            
        Returns:
            业务实体实例
        """
        raise NotImplementedError("Subclass must implement _to_entity method")
    
    def _to_model(self, entity: EntityType) -> ModelType:
        """将业务实体转换为 ORM 模型
        
        子类可选实现此方法，用于 save 操作
        
        Args:
            entity: 业务实体实例
            
        Returns:
            ORM 模型实例
        """
        raise NotImplementedError("Subclass must implement _to_model method")
    
    def get_by_id(self, id_value: Any, id_field: str = "id") -> Optional[EntityType]:
        """根据 ID 获取单个实体
        
        Args:
            id_value: ID 值
            id_field: ID 字段名，默认为 "id"
            
        Returns:
            实体或 None
        """
        model = self.db.query(self.model_class).filter(
            getattr(self.model_class, id_field) == id_value
        ).first()
        
        if model:
            return self._to_entity(model)
        return None
    
    def get_all(self, limit: int = 1000, offset: int = 0) -> List[EntityType]:
        """获取所有实体
        
        Args:
            limit: 最大返回数量
            offset: 偏移量
            
        Returns:
            实体列表
        """
        models = self.db.query(self.model_class).offset(offset).limit(limit).all()
        return [self._to_entity(m) for m in models]
    
    def get_by_filters(
        self,
        filters: Dict[str, Any],
        limit: int = 1000,
        offset: int = 0,
        order_by: Optional[str] = None,
        order_desc: bool = False,
    ) -> List[EntityType]:
        """根据过滤条件获取实体列表
        
        Args:
            filters: 过滤条件字典 {字段名: 值}
            limit: 最大返回数量
            offset: 偏移量
            order_by: 排序字段
            order_desc: 是否降序
            
        Returns:
            实体列表
        """
        query = self.db.query(self.model_class)
        
        # 应用过滤条件
        conditions = []
        for field, value in filters.items():
            if hasattr(self.model_class, field):
                conditions.append(getattr(self.model_class, field) == value)
        
        if conditions:
            query = query.filter(and_(*conditions))
        
        # 应用排序
        if order_by and hasattr(self.model_class, order_by):
            order_field = getattr(self.model_class, order_by)
            if order_desc:
                query = query.order_by(order_field.desc())
            else:
                query = query.order_by(order_field.asc())
        
        models = query.offset(offset).limit(limit).all()
        return [self._to_entity(m) for m in models]
    
    def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """统计实体数量
        
        Args:
            filters: 可选的过滤条件
            
        Returns:
            数量
        """
        query = self.db.query(self.model_class)
        
        if filters:
            conditions = []
            for field, value in filters.items():
                if hasattr(self.model_class, field):
                    conditions.append(getattr(self.model_class, field) == value)
            if conditions:
                query = query.filter(and_(*conditions))
        
        return query.count()
    
    def exists(self, filters: Dict[str, Any]) -> bool:
        """检查是否存在符合条件的实体
        
        Args:
            filters: 过滤条件
            
        Returns:
            是否存在
        """
        return self.count(filters) > 0
    
    def delete_by_id(self, id_value: Any, id_field: str = "id") -> bool:
        """根据 ID 删除实体
        
        Args:
            id_value: ID 值
            id_field: ID 字段名
            
        Returns:
            是否删除成功
        """
        result = self.db.query(self.model_class).filter(
            getattr(self.model_class, id_field) == id_value
        ).delete()
        self.db.commit()
        return result > 0
    
    def delete_by_filters(self, filters: Dict[str, Any]) -> int:
        """根据过滤条件删除实体
        
        Args:
            filters: 过滤条件
            
        Returns:
            删除的数量
        """
        query = self.db.query(self.model_class)
        
        conditions = []
        for field, value in filters.items():
            if hasattr(self.model_class, field):
                conditions.append(getattr(self.model_class, field) == value)
        
        if conditions:
            query = query.filter(and_(*conditions))
        
        result = query.delete()
        self.db.commit()
        return result
    
    def update_by_id(
        self,
        id_value: Any,
        update_data: Dict[str, Any],
        id_field: str = "id",
    ) -> bool:
        """根据 ID 更新实体
        
        Args:
            id_value: ID 值
            update_data: 更新数据字典
            id_field: ID 字段名
            
        Returns:
            是否更新成功
        """
        # 过滤掉不存在的字段
        valid_data = {
            k: v for k, v in update_data.items()
            if hasattr(self.model_class, k)
        }
        
        if not valid_data:
            return False
        
        result = self.db.query(self.model_class).filter(
            getattr(self.model_class, id_field) == id_value
        ).update(valid_data)
        self.db.commit()
        return result > 0
