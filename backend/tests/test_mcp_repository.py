"""MCP数据仓库属性测试

Feature: mcp-marketplace, Property 1: Data Storage Round Trip
Validates: Requirements 1.1, 1.2, 1.3
"""

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base
from app.db.mcp_repository import MCPRepository
from app.api.schemas import MCPServerCreate, MCPConnectionCreate, MCPToolCreate


def create_test_session():
    """创建测试数据库会话"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return TestingSessionLocal()


# ============== Hypothesis Strategies ==============

@st.composite
def mcp_connection_strategy(draw):
    """生成MCP连接配置的策略"""
    return MCPConnectionCreate(
        connection_type=draw(st.sampled_from(["stdio", "http", "sse"])),
        command=draw(st.text(min_size=1, max_size=50, alphabet=st.characters(
            whitelist_categories=("L", "N"),
            whitelist_characters="-_./",
        )).filter(lambda x: len(x.strip()) > 0)),
        args=draw(st.lists(
            st.text(min_size=1, max_size=30, alphabet=st.characters(
                whitelist_categories=("L", "N"),
                whitelist_characters="-_./=",
            )).filter(lambda x: len(x.strip()) > 0),
            min_size=0,
            max_size=5,
        )),
        env=draw(st.dictionaries(
            keys=st.text(min_size=1, max_size=20, alphabet=st.characters(
                whitelist_categories=("Lu", "N"),
                whitelist_characters="_",
            )).filter(lambda x: len(x.strip()) > 0),
            values=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
            min_size=0,
            max_size=3,
        )),
    )


@st.composite
def mcp_tool_strategy(draw):
    """生成MCP工具定义的策略"""
    return MCPToolCreate(
        name=draw(st.text(min_size=1, max_size=50, alphabet=st.characters(
            whitelist_categories=("L", "N"),
            whitelist_characters="-_",
        )).filter(lambda x: len(x.strip()) > 0)),
        description=draw(st.text(min_size=0, max_size=200)),
        input_schema=draw(st.fixed_dictionaries({
            "type": st.just("object"),
            "properties": st.dictionaries(
                keys=st.text(min_size=1, max_size=20, alphabet=st.characters(
                    whitelist_categories=("L", "N"),
                    whitelist_characters="_",
                )).filter(lambda x: len(x.strip()) > 0),
                values=st.fixed_dictionaries({
                    "type": st.sampled_from(["string", "number", "boolean"]),
                }),
                min_size=0,
                max_size=3,
            ),
        })),
        translation=draw(st.text(min_size=0, max_size=100)),
    )


@st.composite
def mcp_server_strategy(draw, unique_suffix=None):
    """生成MCP服务的策略"""
    # 生成唯一的qualified_name
    base_name = draw(st.text(min_size=3, max_size=30, alphabet=st.characters(
        whitelist_categories=("L", "N"),
        whitelist_characters="-_",
    )).filter(lambda x: len(x.strip()) >= 3))
    
    # 添加随机后缀确保唯一性
    suffix = draw(st.integers(min_value=1, max_value=999999))
    qualified_name = f"@test/{base_name}-{suffix}"
    
    return MCPServerCreate(
        qualified_name=qualified_name,
        display_name=draw(st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0)),
        description=draw(st.text(min_size=0, max_size=200)),
        logo=draw(st.one_of(st.none(), st.text(min_size=5, max_size=100).map(lambda x: f"https://example.com/{x}.png"))),
        creator=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0))),
        type=draw(st.integers(min_value=1, max_value=3)),
        tag=draw(st.one_of(st.none(), st.text(min_size=1, max_size=100))),
        introduction=draw(st.one_of(st.none(), st.text(min_size=0, max_size=500))),
        is_domestic=draw(st.booleans()),
        package_url=draw(st.one_of(st.none(), st.text(min_size=5, max_size=100).map(lambda x: f"https://npm.example.com/{x}"))),
        repository_id=draw(st.one_of(st.none(), st.text(min_size=1, max_size=50))),
        connections=draw(st.lists(mcp_connection_strategy(), min_size=0, max_size=3)),
        tools=draw(st.lists(mcp_tool_strategy(), min_size=0, max_size=5)),
    )


# ============== Property Tests ==============

class TestMCPRepositoryProperties:
    """MCP数据仓库属性测试类"""

    @given(server_data=mcp_server_strategy())
    @settings(max_examples=100, deadline=5000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_data_storage_round_trip(self, server_data: MCPServerCreate):
        """
        Feature: mcp-marketplace, Property 1: Data Storage Round Trip
        Validates: Requirements 1.1, 1.2, 1.3
        
        For any valid MCP server with connections and tools, creating the server
        and then retrieving it should return an equivalent object with all fields preserved.
        """
        # Create fresh session for each test iteration
        db_session = create_test_session()
        
        try:
            repo = MCPRepository(db_session)
            
            # Create server
            created = repo.create(server_data)
            assert created is not None
            assert created.server_id is not None
            
            # Retrieve server
            retrieved = repo.find_by_id(created.server_id)
            assert retrieved is not None
            
            # Verify basic fields are preserved
            assert retrieved.qualified_name == server_data.qualified_name
            assert retrieved.display_name == server_data.display_name
            assert retrieved.description == server_data.description
            assert retrieved.logo == server_data.logo
            assert retrieved.creator == server_data.creator
            assert retrieved.type == server_data.type
            assert retrieved.tag == server_data.tag
            assert retrieved.introduction == server_data.introduction
            assert retrieved.is_domestic == (1 if server_data.is_domestic else 0)
            assert retrieved.package_url == server_data.package_url
            assert retrieved.repository_id == server_data.repository_id
            
            # Verify use_count is initialized to 0
            assert retrieved.use_count == 0
            
            # Verify is_enabled is initialized to 1
            assert retrieved.is_enabled == 1
            
            # Verify connections are preserved
            assert len(retrieved.connections) == len(server_data.connections)
            for i, conn in enumerate(retrieved.connections):
                expected = server_data.connections[i]
                assert conn.connection_type == expected.connection_type
                assert conn.command == expected.command
                assert conn.args == expected.args
                assert conn.env == expected.env
            
            # Verify tools are preserved
            assert len(retrieved.tools) == len(server_data.tools)
            for i, tool in enumerate(retrieved.tools):
                expected = server_data.tools[i]
                assert tool.name == expected.name
                assert tool.description == expected.description
                assert tool.input_schema == expected.input_schema
                assert tool.translation == expected.translation
        finally:
            db_session.close()
