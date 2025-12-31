/*
 MCP Marketplace Schema
 
 Source Server Type    : MySQL
 Source Server Version : 50744 (5.7.44)
 
 Date: 2025-12-30
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for mcp_servers
-- ----------------------------
DROP TABLE IF EXISTS `mcp_servers`;
CREATE TABLE `mcp_servers` (
  `server_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'MCP服务ID',
  `qualified_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '唯一标识名，如@amap/amap-maps-mcp-server',
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '显示名称',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '服务描述',
  `logo` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Logo图片URL',
  `creator` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '创建者/提供商',
  `type` tinyint(4) NOT NULL DEFAULT '1' COMMENT '服务类型：1=官方，2=社区，3=第三方',
  `tag` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签，逗号分隔',
  `introduction` text COLLATE utf8mb4_unicode_ci COMMENT '详细介绍',
  `is_domestic` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否国内服务：0=否，1=是',
  `package_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '包地址URL，如npm包地址',
  `repository_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '仓库ID',
  `use_count` bigint(20) NOT NULL DEFAULT '0' COMMENT '使用/调用次数',
  `is_enabled` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否启用：0=禁用，1=启用',
  `is_deleted` tinyint(4) NOT NULL DEFAULT '0' COMMENT '软删除标记：0=正常，1=已删除',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`server_id`),
  UNIQUE KEY `uk_qualified_name` (`qualified_name`),
  KEY `idx_display_name` (`display_name`),
  KEY `idx_is_enabled` (`is_enabled`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='MCP服务主表';

-- ----------------------------
-- Table structure for mcp_connections
-- ----------------------------
DROP TABLE IF EXISTS `mcp_connections`;
CREATE TABLE `mcp_connections` (
  `connection_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '连接配置ID',
  `server_id` bigint(20) NOT NULL COMMENT '关联的MCP服务ID',
  `connection_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '连接类型：stdio/http/sse',
  `command` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '启动命令，如npx',
  `args` json DEFAULT NULL COMMENT '命令参数，JSON数组格式',
  `env` json DEFAULT NULL COMMENT '环境变量，JSON对象格式',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`connection_id`),
  KEY `idx_server_id` (`server_id`),
  CONSTRAINT `fk_mcp_conn_server` FOREIGN KEY (`server_id`) REFERENCES `mcp_servers` (`server_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='MCP连接配置表';

-- ----------------------------
-- Table structure for mcp_tools
-- ----------------------------
DROP TABLE IF EXISTS `mcp_tools`;
CREATE TABLE `mcp_tools` (
  `tool_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '工具ID',
  `server_id` bigint(20) NOT NULL COMMENT '关联的MCP服务ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '工具名称',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '工具描述',
  `input_schema` json DEFAULT NULL COMMENT '输入参数Schema，JSON Schema格式',
  `translation` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '中文翻译/说明',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`tool_id`),
  KEY `idx_server_id` (`server_id`),
  KEY `idx_name` (`name`),
  CONSTRAINT `fk_mcp_tool_server` FOREIGN KEY (`server_id`) REFERENCES `mcp_servers` (`server_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='MCP工具定义表';

SET FOREIGN_KEY_CHECKS = 1;
