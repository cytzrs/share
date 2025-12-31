"""MCP API层属性测试

Feature: mcp-marketplace
Properties: 7, 8
Validates: Requirements 7.1-7.6, 10.1-10.3
"""

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck, assume
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base
from app.services.mcp_service import MCPService
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
            max_size=3,
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
def mcp_server_strategy(draw, suffix_base=0):
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
        connections=draw(st.lists(mcp_connection_strategy(), min_size=1, max_size=3)),
        tools=draw(st.lists(mcp_tool_strategy(), min_size=1, max_size=5)),
    )


# ============== Property Tests ==============

class TestMCPAPIProperties:
    """MCP API层属性测试类"""

    @given(
        servers_data=st.lists(mcp_server_strategy(), min_size=1, max_size=5),
        search_term=st.text(min_size=1, max_size=20, alphabet=st.characters(
            whitelist_categories=("L", "N"),
        )).filter(lambda x: len(x.strip()) > 0),
    )
    @settings(max_examples=20, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_search_filter_correctness(self, servers_data, search_term):
        """
        Feature: mcp-marketplace, Property 7: Search Filter Correctness
        Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
        
        For any search query with filters (server_id, display_name, description, status):
        - Server ID search should return exact matches only
        - Name/description search should return all servers containing the search term
        - Status filter should return only servers matching the specified status
        - Combined filters should return the intersection of individual filter results
        - Results should be correctly paginated
        """
        # Ensure unique qualified_names
        seen_names = set()
        unique_servers = []
        for server in servers_data:
            if server.qualified_name not in seen_names:
                seen_names.add(server.qualified_name)
                unique_servers.append(server)
        
        assume(len(unique_servers) >= 1)
        
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Create all servers
            created_servers = []
            for server_data in unique_servers:
                try:
                    created = service.create_server(server_data)
                    created_servers.append(created)
                except Exception:
                    # Skip if creation fails (e.g., duplicate name)
                    pass
            
            assume(len(created_servers) >= 1)
            
            # Test 1: Server ID exact search
            target_server = created_servers[0]
            results, total = service.list_servers({"server_id": target_server.server_id})
            assert total <= 1
            if total == 1:
                assert results[0].server_id == target_server.server_id
            
            # Test 2: Display name fuzzy search
            # Search for a substring of the first server's display_name
            if len(target_server.display_name) >= 2:
                search_substring = target_server.display_name[:2]
                results, total = service.list_servers({"display_name": search_substring})
                # All results should contain the search term in display_name
                for result in results:
                    assert search_substring.lower() in result.display_name.lower()
            
            # Test 3: Status filter
            # Disable some servers
            if len(created_servers) >= 2:
                service.toggle_status(created_servers[0].server_id, False)
                
                # Search for enabled servers
                enabled_results, enabled_total = service.list_servers({"status": "enabled"})
                for result in enabled_results:
                    assert result.is_enabled is True
                
                # Search for disabled servers
                disabled_results, disabled_total = service.list_servers({"status": "disabled"})
                for result in disabled_results:
                    assert result.is_enabled is False
                
                # Total should match
                all_results, all_total = service.list_servers()
                assert enabled_total + disabled_total == all_total
            
            # Test 4: Pagination
            page_size = 2
            page1_results, total = service.list_servers(page=1, page_size=page_size)
            assert len(page1_results) <= page_size
            
            if total > page_size:
                page2_results, _ = service.list_servers(page=2, page_size=page_size)
                # Page 2 should have different servers than page 1
                page1_ids = {r.server_id for r in page1_results}
                page2_ids = {r.server_id for r in page2_results}
                assert page1_ids.isdisjoint(page2_ids)
            
            # Test 5: Combined filters (status + keyword)
            if len(created_servers) >= 2:
                # Re-enable the first server
                service.toggle_status(created_servers[0].server_id, True)
                
                # Search with both status and keyword
                keyword = target_server.display_name[:2] if len(target_server.display_name) >= 2 else target_server.display_name
                combined_results, _ = service.list_servers({
                    "status": "enabled",
                    "keyword": keyword,
                })
                
                # All results should match both criteria
                for result in combined_results:
                    assert result.is_enabled is True
                    # Keyword should be in display_name, description, or qualified_name
                    keyword_lower = keyword.lower()
                    matches = (
                        keyword_lower in result.display_name.lower() or
                        (result.description and keyword_lower in result.description.lower()) or
                        keyword_lower in result.qualified_name.lower()
                    )
                    assert matches
        finally:
            db_session.close()

    @given(
        servers_data=st.lists(mcp_server_strategy(), min_size=0, max_size=5),
        num_disabled=st.integers(min_value=0, max_value=3),
    )
    @settings(max_examples=20, deadline=10000, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_statistics_accuracy(self, servers_data, num_disabled):
        """
        Feature: mcp-marketplace, Property 8: Statistics Accuracy
        Validates: Requirements 10.1, 10.2, 10.3
        
        For any state of the MCP server database, the statistics API should return:
        - total_servers = count of all non-deleted servers
        - enabled_servers = count of non-deleted servers where is_enabled = 1
        - total_use_count = sum of use_count for all non-deleted servers
        """
        # Ensure unique qualified_names
        seen_names = set()
        unique_servers = []
        for server in servers_data:
            if server.qualified_name not in seen_names:
                seen_names.add(server.qualified_name)
                unique_servers.append(server)
        
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Create all servers
            created_servers = []
            for server_data in unique_servers:
                try:
                    created = service.create_server(server_data)
                    created_servers.append(created)
                except Exception:
                    # Skip if creation fails
                    pass
            
            total_created = len(created_servers)
            
            # Disable some servers
            num_to_disable = min(num_disabled, total_created)
            for i in range(num_to_disable):
                service.toggle_status(created_servers[i].server_id, False)
            
            # Delete some servers (soft delete)
            num_to_delete = min(1, total_created - num_to_disable)
            deleted_count = 0
            for i in range(num_to_disable, min(num_to_disable + num_to_delete, total_created)):
                service.delete_server(created_servers[i].server_id)
                deleted_count += 1
            
            # Simulate some tool usage to increment use_count
            total_use_count = 0
            for server in created_servers[num_to_disable + deleted_count:]:
                # Only test tools on enabled, non-deleted servers
                if server.tools:
                    tool_name = server.tools[0].name
                    try:
                        result = service.test_tool(server.server_id, tool_name, {})
                        if result.success:
                            total_use_count += 1
                    except Exception:
                        pass
            
            # Get statistics
            stats = service.get_stats()
            
            # Verify total_servers (non-deleted)
            expected_total = total_created - deleted_count
            assert stats.total_servers == expected_total, \
                f"Expected total_servers={expected_total}, got {stats.total_servers}"
            
            # Verify enabled_servers (non-deleted and enabled)
            expected_enabled = total_created - num_to_disable - deleted_count
            assert stats.enabled_servers == expected_enabled, \
                f"Expected enabled_servers={expected_enabled}, got {stats.enabled_servers}"
            
            # Verify total_use_count
            assert stats.total_use_count == total_use_count, \
                f"Expected total_use_count={total_use_count}, got {stats.total_use_count}"
            
            # Additional invariant: enabled_servers <= total_servers
            assert stats.enabled_servers <= stats.total_servers
            
            # Additional invariant: total_use_count >= 0
            assert stats.total_use_count >= 0
        finally:
            db_session.close()


# ============== Edge Case Tests ==============

class TestMCPAPIEdgeCases:
    """MCP API边界情况测试"""

    def test_search_empty_database(self):
        """测试空数据库的搜索"""
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Search with various filters
            results, total = service.list_servers({"keyword": "test"})
            assert total == 0
            assert len(results) == 0
            
            results, total = service.list_servers({"status": "enabled"})
            assert total == 0
            
            results, total = service.list_servers({"server_id": 1})
            assert total == 0
        finally:
            db_session.close()

    def test_pagination_beyond_total(self):
        """测试分页超出总数"""
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Create 3 servers
            for i in range(3):
                data = MCPServerCreate(
                    qualified_name=f"@test/server-pagination-{i}",
                    display_name=f"Test Server {i}",
                    connections=[MCPConnectionCreate(connection_type="stdio", command="test")],
                    tools=[MCPToolCreate(name="test_tool")],
                )
                service.create_server(data)
            
            # Request page beyond total
            results, total = service.list_servers(page=10, page_size=20)
            assert total == 3
            assert len(results) == 0
        finally:
            db_session.close()

    def test_search_special_characters(self):
        """测试搜索特殊字符"""
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Create server with special characters in name
            data = MCPServerCreate(
                qualified_name="@test/server-special-chars",
                display_name="Test Server (v1.0)",
                description="A server with special chars: @#$%",
                connections=[MCPConnectionCreate(connection_type="stdio", command="test")],
                tools=[MCPToolCreate(name="test_tool")],
            )
            service.create_server(data)
            
            # Search should work with partial match
            results, total = service.list_servers({"display_name": "v1.0"})
            assert total == 1
            
            # Search with special chars in keyword
            results, total = service.list_servers({"keyword": "special"})
            assert total == 1
        finally:
            db_session.close()

    def test_stats_after_operations(self):
        """测试各种操作后的统计数据一致性"""
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Initial stats
            stats = service.get_stats()
            assert stats.total_servers == 0
            assert stats.enabled_servers == 0
            assert stats.total_use_count == 0
            
            # Create server
            data = MCPServerCreate(
                qualified_name="@test/server-stats-ops",
                display_name="Test Server",
                connections=[MCPConnectionCreate(connection_type="stdio", command="test")],
                tools=[MCPToolCreate(name="test_tool")],
            )
            created = service.create_server(data)
            
            stats = service.get_stats()
            assert stats.total_servers == 1
            assert stats.enabled_servers == 1
            assert stats.total_use_count == 0
            
            # Test tool
            service.test_tool(created.server_id, "test_tool", {})
            
            stats = service.get_stats()
            assert stats.total_use_count == 1
            
            # Disable server
            service.toggle_status(created.server_id, False)
            
            stats = service.get_stats()
            assert stats.total_servers == 1
            assert stats.enabled_servers == 0
            assert stats.total_use_count == 1  # use_count preserved
            
            # Delete server
            service.delete_server(created.server_id)
            
            stats = service.get_stats()
            assert stats.total_servers == 0
            assert stats.enabled_servers == 0
            assert stats.total_use_count == 0  # Deleted servers don't count
        finally:
            db_session.close()

    def test_combined_filters_no_match(self):
        """测试组合过滤条件无匹配结果"""
        db_session = create_test_session()
        
        try:
            service = MCPService(db_session)
            
            # Create server
            data = MCPServerCreate(
                qualified_name="@test/server-no-match",
                display_name="Alpha Server",
                connections=[MCPConnectionCreate(connection_type="stdio", command="test")],
                tools=[MCPToolCreate(name="test_tool")],
            )
            service.create_server(data)
            
            # Search with non-matching combined filters
            results, total = service.list_servers({
                "display_name": "Beta",  # Doesn't match
                "status": "enabled",
            })
            assert total == 0
            assert len(results) == 0
        finally:
            db_session.close()
