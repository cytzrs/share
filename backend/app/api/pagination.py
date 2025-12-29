"""分页和排序工具模块"""

from typing import TypeVar, Generic, List, Optional, Any
from fastapi import Query
from pydantic import BaseModel
from sqlalchemy.orm import Query as SQLQuery
from sqlalchemy import asc, desc


T = TypeVar("T")


class PaginationParams:
    """分页参数依赖注入类
    
    使用方式:
        @router.get("/items")
        async def list_items(pagination: PaginationParams = Depends()):
            ...
    """
    
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="页码，从1开始"),
        page_size: int = Query(default=20, ge=1, le=100, description="每页数量，最大100"),
    ):
        self.page = page
        self.page_size = page_size
    
    @property
    def offset(self) -> int:
        """计算偏移量"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """获取限制数量"""
        return self.page_size


class SortParams:
    """排序参数依赖注入类
    
    使用方式:
        @router.get("/items")
        async def list_items(sort: SortParams = Depends()):
            ...
    """
    
    def __init__(
        self,
        sort_by: Optional[str] = Query(default=None, description="排序字段"),
        sort_order: str = Query(default="desc", pattern="^(asc|desc)$", description="排序方向"),
    ):
        self.sort_by = sort_by
        self.sort_order = sort_order
    
    @property
    def is_ascending(self) -> bool:
        """是否升序"""
        return self.sort_order == "asc"


class PagedResult(BaseModel, Generic[T]):
    """分页结果通用模型"""
    items: List[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
    
    @classmethod
    def create(
        cls,
        items: List[Any],
        total: int,
        page: int,
        page_size: int,
    ) -> "PagedResult":
        """创建分页结果"""
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


def paginate_query(
    query: SQLQuery,
    pagination: PaginationParams,
    sort: Optional[SortParams] = None,
    default_sort_column: Optional[Any] = None,
    allowed_sort_columns: Optional[dict] = None,
) -> tuple:
    """对SQLAlchemy查询应用分页和排序
    
    Args:
        query: SQLAlchemy查询对象
        pagination: 分页参数
        sort: 排序参数（可选）
        default_sort_column: 默认排序列
        allowed_sort_columns: 允许的排序列映射 {字段名: 列对象}
        
    Returns:
        (分页后的结果列表, 总数)
    """
    # 获取总数
    total = query.count()
    
    # 应用排序
    if sort and sort.sort_by and allowed_sort_columns:
        sort_column = allowed_sort_columns.get(sort.sort_by)
        if sort_column is not None:
            if sort.is_ascending:
                query = query.order_by(asc(sort_column))
            else:
                query = query.order_by(desc(sort_column))
    elif default_sort_column is not None:
        query = query.order_by(desc(default_sort_column))
    
    # 应用分页
    items = query.offset(pagination.offset).limit(pagination.limit).all()
    
    return items, total


def calculate_total_pages(total: int, page_size: int) -> int:
    """计算总页数"""
    if page_size <= 0:
        return 0
    return (total + page_size - 1) // page_size


def validate_page_range(page: int, total_pages: int) -> bool:
    """验证页码是否在有效范围内"""
    if total_pages == 0:
        return page == 1
    return 1 <= page <= total_pages
