/*
 Navicat Premium Dump SQL

 Source Server         : 127.0.0.1
 Source Server Type    : MySQL
 Source Server Version : 50744 (5.7.44)
 Source Host           : 127.0.0.1:3306
 Source Schema         : quant_trading

 Target Server Type    : MySQL
 Target Server Version : 50744 (5.7.44)
 File Encoding         : 65001

 Date: 28/12/2025 22:21:37
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for decision_logs
-- ----------------------------
DROP TABLE IF EXISTS `decision_logs`;
CREATE TABLE `decision_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_content` text COLLATE utf8mb4_unicode_ci,
  `llm_response` text COLLATE utf8mb4_unicode_ci,
  `parsed_decision` json DEFAULT NULL,
  `validation_result` json DEFAULT NULL,
  `order_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'success' COMMENT '决策状态: success, no_trade, api_error',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  PRIMARY KEY (`id`),
  KEY `idx_agent_created` (`agent_id`,`created_at`),
  KEY `idx_decision_status` (`status`),
  CONSTRAINT `decision_logs_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `model_agents` (`agent_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=168 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for llm_providers
-- ----------------------------
DROP TABLE IF EXISTS `llm_providers`;
CREATE TABLE `llm_providers` (
  `provider_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `protocol` varchar(20) NOT NULL COMMENT 'openai, anthropic, gemini',
  `api_url` varchar(500) NOT NULL,
  `api_key` varchar(500) NOT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`provider_id`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='LLM渠道配置表';

-- ----------------------------
-- Table structure for llm_request_logs
-- ----------------------------
DROP TABLE IF EXISTS `llm_request_logs`;
CREATE TABLE `llm_request_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'LLM渠道ID',
  `model_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '模型名称',
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Agent ID（可为空，非Agent调用时）',
  `request_content` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '请求内容（prompt）',
  `response_content` text COLLATE utf8mb4_unicode_ci COMMENT '响应内容',
  `duration_ms` int(11) NOT NULL DEFAULT '0' COMMENT '耗时（毫秒）',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success' COMMENT '状态：success/error',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  `tokens_input` int(11) DEFAULT NULL COMMENT '输入token数',
  `tokens_output` int(11) DEFAULT NULL COMMENT '输出token数',
  `request_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '请求时间',
  PRIMARY KEY (`id`),
  KEY `idx_provider_id` (`provider_id`),
  KEY `idx_agent_id` (`agent_id`),
  KEY `idx_request_time` (`request_time`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=258 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='LLM请求日志表';

-- ----------------------------
-- Table structure for market_data
-- ----------------------------
DROP TABLE IF EXISTS `market_data`;
CREATE TABLE `market_data` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `data_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据类型: market_sentiment, index_overview, hot_stocks',
  `data_content` json NOT NULL COMMENT '数据内容（JSON格式）',
  `data_date` date NOT NULL COMMENT '数据日期',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_date` (`data_type`,`data_date`),
  KEY `idx_data_type` (`data_type`),
  KEY `idx_data_date` (`data_date`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for model_agents
-- ----------------------------
DROP TABLE IF EXISTS `model_agents`;
CREATE TABLE `model_agents` (
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT 'LLM渠道ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `llm_model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `initial_cash` decimal(18,2) NOT NULL DEFAULT '20000.00',
  `current_cash` decimal(18,2) NOT NULL,
  `template_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `schedule_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'daily',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for orders
-- ----------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `order_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `side` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price` decimal(10,3) DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reject_reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `llm_request_log_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_agent_created` (`agent_id`,`created_at`),
  KEY `idx_order_llm_log` (`llm_request_log_id`),
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `model_agents` (`agent_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for positions
-- ----------------------------
DROP TABLE IF EXISTS `positions`;
CREATE TABLE `positions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `shares` int(11) NOT NULL,
  `avg_cost` decimal(10,3) NOT NULL,
  `buy_date` date NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agent_stock` (`agent_id`,`stock_code`),
  CONSTRAINT `positions_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `model_agents` (`agent_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for prompt_templates
-- ----------------------------
DROP TABLE IF EXISTS `prompt_templates`;
CREATE TABLE `prompt_templates` (
  `template_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int(11) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for sentiment_scores
-- ----------------------------
DROP TABLE IF EXISTS `sentiment_scores`;
CREATE TABLE `sentiment_scores` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `score` decimal(4,3) NOT NULL,
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analyzed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_code_time` (`stock_code`,`analyzed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for stock_ai_analysis
-- ----------------------------
DROP TABLE IF EXISTS `stock_ai_analysis`;
CREATE TABLE `stock_ai_analysis` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '股票代码',
  `analysis_data` json NOT NULL COMMENT '分析结果JSON数据',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `expires_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '过期时间',
  PRIMARY KEY (`id`),
  KEY `idx_stock_ai_analysis_code` (`stock_code`),
  KEY `idx_stock_ai_analysis_expires` (`expires_at`),
  KEY `idx_stock_ai_analysis_code_expires` (`stock_code`,`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI股票分析缓存表';

-- ----------------------------
-- Table structure for stock_quotes
-- ----------------------------
DROP TABLE IF EXISTS `stock_quotes`;
CREATE TABLE `stock_quotes` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trade_date` date NOT NULL,
  `open_price` decimal(10,3) DEFAULT NULL,
  `high_price` decimal(10,3) DEFAULT NULL,
  `low_price` decimal(10,3) DEFAULT NULL,
  `close_price` decimal(10,3) DEFAULT NULL,
  `prev_close` decimal(10,3) DEFAULT NULL,
  `volume` bigint(20) DEFAULT NULL,
  `amount` decimal(18,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_date` (`stock_code`,`trade_date`),
  KEY `idx_trade_date` (`trade_date`),
  KEY `idx_stock_code_name` (`stock_code`,`stock_name`)
) ENGINE=InnoDB AUTO_INCREMENT=499580 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Table structure for system_task_logs
-- ----------------------------
DROP TABLE IF EXISTS `system_task_logs`;
CREATE TABLE `system_task_logs` (
  `log_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `task_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '任务ID，外键关联system_tasks',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '开始时间',
  `completed_at` timestamp NULL DEFAULT NULL COMMENT '完成时间',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '状态：running/success/failed/skipped',
  `agent_results` json DEFAULT NULL COMMENT 'Agent执行结果列表',
  `skip_reason` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '跳过原因',
  `error_message` text COLLATE utf8mb4_unicode_ci COMMENT '错误信息',
  PRIMARY KEY (`log_id`),
  KEY `idx_task_log_task_id` (`task_id`),
  KEY `idx_task_log_status` (`status`),
  KEY `idx_task_log_started_at` (`started_at`),
  CONSTRAINT `fk_task_log_task` FOREIGN KEY (`task_id`) REFERENCES `system_tasks` (`task_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统任务执行日志表';

-- ----------------------------
-- Table structure for system_tasks
-- ----------------------------
DROP TABLE IF EXISTS `system_tasks`;
CREATE TABLE `system_tasks` (
  `task_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务ID (UUID)',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '任务名称',
  `task_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'agent_decision' COMMENT '任务类型：agent_decision/quote_sync/market_refresh',
  `cron_expression` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Cron表达式',
  `agent_ids` json NOT NULL COMMENT 'Agent ID列表，["all"]表示全部',
  `config` json DEFAULT NULL COMMENT '任务配置（JSON格式）',
  `trading_day_only` tinyint(4) DEFAULT '0' COMMENT '仅交易日运行，0=否，1=是',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态：active/paused',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`task_id`),
  KEY `idx_system_task_status` (`status`),
  KEY `idx_system_task_name` (`name`),
  KEY `idx_system_task_type` (`task_type`),
  KEY `idx_system_task_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统任务表';

-- ----------------------------
-- Table structure for transactions
-- ----------------------------
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `tx_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stock_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `side` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price` decimal(10,3) DEFAULT NULL,
  `commission` decimal(10,2) DEFAULT NULL,
  `stamp_tax` decimal(10,2) DEFAULT NULL,
  `transfer_fee` decimal(10,2) DEFAULT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decision_log_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`tx_id`),
  KEY `order_id` (`order_id`),
  KEY `idx_agent_executed` (`agent_id`,`executed_at`),
  KEY `idx_decision_log` (`decision_log_id`),
  CONSTRAINT `fk_transaction_decision_log` FOREIGN KEY (`decision_log_id`) REFERENCES `decision_logs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `model_agents` (`agent_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
