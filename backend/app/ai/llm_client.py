"""LLM客户端 - 支持多协议的大语言模型客户端"""

import json
import logging
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

import httpx

from app.core.config import settings
from app.models.enums import LLMProtocol


logger = logging.getLogger(__name__)


@dataclass
class Message:
    """聊天消息"""
    role: str  # "system", "user", "assistant"
    content: str
    
    def to_dict(self) -> Dict[str, str]:
        """转换为字典"""
        return {"role": self.role, "content": self.content}
    
    @classmethod
    def from_dict(cls, data: Dict[str, str]) -> "Message":
        """从字典创建"""
        return cls(role=data["role"], content=data["content"])


@dataclass
class ChatResponse:
    """聊天响应"""
    content: str
    model: str
    usage: Optional[Dict[str, int]] = None
    finish_reason: Optional[str] = None


class LLMError(Exception):
    """LLM相关错误"""
    pass


class MultiProtocolLLMClient:
    """
    多协议LLM客户端
    
    支持OpenAI、Anthropic、Gemini等多种协议。
    """
    
    def __init__(
        self,
        protocol: LLMProtocol = LLMProtocol.OPENAI,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout: float = 60.0,
        provider_id: Optional[str] = None,
    ):
        """
        初始化多协议LLM客户端
        
        Args:
            protocol: 协议类型
            api_base: API基础URL
            api_key: API密钥
            default_model: 默认模型名称
            timeout: 请求超时时间（秒）
            provider_id: LLM渠道ID（用于日志记录）
        """
        self.protocol = protocol
        self.api_base = (api_base or self._get_default_api_base()).rstrip("/")
        self.api_key = api_key or settings.LLM_API_KEY
        self.default_model = default_model or self._get_default_model()
        self.timeout = timeout
        self.provider_id = provider_id
        
        # 用于日志记录的上下文
        self._current_agent_id: Optional[str] = None
        self._log_callback: Optional[callable] = None
        
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            headers=self._get_headers(),
        )
    
    def _get_default_api_base(self) -> str:
        """获取默认API地址"""
        defaults = {
            LLMProtocol.OPENAI: "https://api.openai.com/v1",
            LLMProtocol.ANTHROPIC: "https://api.anthropic.com",
            LLMProtocol.GEMINI: "https://generativelanguage.googleapis.com/v1beta",
        }
        return defaults.get(self.protocol, settings.LLM_API_BASE)
    
    def _get_default_model(self) -> str:
        """获取默认模型"""
        defaults = {
            LLMProtocol.OPENAI: "gpt-4",
            LLMProtocol.ANTHROPIC: "claude-3-sonnet-20240229",
            LLMProtocol.GEMINI: "gemini-pro",
        }
        return defaults.get(self.protocol, settings.LLM_MODEL)
    
    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = {"Content-Type": "application/json"}
        
        if self.protocol == LLMProtocol.OPENAI:
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.protocol == LLMProtocol.ANTHROPIC:
            if self.api_key:
                headers["x-api-key"] = self.api_key
                headers["anthropic-version"] = "2023-06-01"
        elif self.protocol == LLMProtocol.GEMINI:
            pass  # Gemini uses query parameter for API key
        
        return headers
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """
        获取可用模型列表
        
        Returns:
            模型列表
        """
        try:
            if self.protocol == LLMProtocol.OPENAI:
                return await self._list_models_openai()
            elif self.protocol == LLMProtocol.ANTHROPIC:
                return await self._list_models_anthropic()
            elif self.protocol == LLMProtocol.GEMINI:
                return await self._list_models_gemini()
            else:
                raise LLMError(f"不支持的协议: {self.protocol}")
        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            raise LLMError(f"获取模型列表失败: {str(e)}") from e
    
    async def _list_models_openai(self) -> List[Dict[str, Any]]:
        """OpenAI协议获取模型列表"""
        response = await self._client.get(f"{self.api_base}/models")
        response.raise_for_status()
        data = response.json()
        models = data.get("data", [])
        # 返回所有模型，不做过滤
        return [{"id": m["id"], "name": m["id"]} for m in models]
    
    async def _list_models_anthropic(self) -> List[Dict[str, Any]]:
        """Anthropic协议获取模型列表（Anthropic没有list models API，返回预定义列表）"""
        return [
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"},
            {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet"},
            {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku"},
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"},
        ]
    
    async def _list_models_gemini(self) -> List[Dict[str, Any]]:
        """Gemini协议获取模型列表"""
        url = f"{self.api_base}/models"
        if self.api_key:
            url += f"?key={self.api_key}"
        response = await self._client.get(url)
        response.raise_for_status()
        data = response.json()
        models = data.get("models", [])
        # 返回所有模型，不做过滤
        return [
            {"id": m["name"].replace("models/", ""), "name": m.get("displayName", m["name"])}
            for m in models
        ]
    
    async def chat(
        self,
        messages: List[Message],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs,
    ) -> ChatResponse:
        """
        发送聊天请求
        
        Args:
            messages: 消息列表
            model: 模型名称
            temperature: 温度参数
            max_tokens: 最大生成token数
            **kwargs: 其他参数
            
        Returns:
            ChatResponse: 聊天响应
        """
        import time
        model = model or self.default_model
        request_content = "\n".join([f"[{m.role}]: {m.content}" for m in messages])
        start_time = time.time()
        
        try:
            if self.protocol == LLMProtocol.OPENAI:
                response = await self._chat_openai(messages, model, temperature, max_tokens, **kwargs)
            elif self.protocol == LLMProtocol.ANTHROPIC:
                response = await self._chat_anthropic(messages, model, temperature, max_tokens, **kwargs)
            elif self.protocol == LLMProtocol.GEMINI:
                response = await self._chat_gemini(messages, model, temperature, max_tokens, **kwargs)
            else:
                raise LLMError(f"不支持的协议: {self.protocol}")
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 记录成功日志
            if self._log_callback:
                self._log_callback(
                    provider_id=self.provider_id,
                    model_name=model,
                    agent_id=self._current_agent_id,
                    request_content=request_content,
                    response_content=response.content,
                    duration_ms=duration_ms,
                    status="success",
                    error_message=None,
                    tokens_input=response.usage.get("prompt_tokens") if response.usage else None,
                    tokens_output=response.usage.get("completion_tokens") if response.usage else None,
                )
            
            return response
            
        except httpx.HTTPStatusError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"API调用失败: HTTP {e.response.status_code}"
            logger.error(f"LLM API HTTP错误: {e.response.status_code} - {e.response.text}")
            
            # 记录错误日志
            if self._log_callback:
                self._log_callback(
                    provider_id=self.provider_id,
                    model_name=model,
                    agent_id=self._current_agent_id,
                    request_content=request_content,
                    response_content=e.response.text[:2000] if e.response.text else None,
                    duration_ms=duration_ms,
                    status="error",
                    error_message=error_msg,
                    tokens_input=None,
                    tokens_output=None,
                )
            
            raise LLMError(error_msg) from e
        except httpx.RequestError as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"API请求失败: {str(e)}"
            logger.error(f"LLM API请求错误: {str(e)}")
            
            # 记录错误日志
            if self._log_callback:
                self._log_callback(
                    provider_id=self.provider_id,
                    model_name=model,
                    agent_id=self._current_agent_id,
                    request_content=request_content,
                    response_content=None,
                    duration_ms=duration_ms,
                    status="error",
                    error_message=error_msg,
                    tokens_input=None,
                    tokens_output=None,
                )
            
            raise LLMError(error_msg) from e
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"API调用失败: {str(e)}"
            logger.error(f"LLM API未知错误: {str(e)}")
            
            # 记录错误日志
            if self._log_callback:
                self._log_callback(
                    provider_id=self.provider_id,
                    model_name=model,
                    agent_id=self._current_agent_id,
                    request_content=request_content,
                    response_content=None,
                    duration_ms=duration_ms,
                    status="error",
                    error_message=error_msg,
                    tokens_input=None,
                    tokens_output=None,
                )
            
            raise LLMError(error_msg) from e
    
    def set_log_callback(self, callback: callable):
        """设置日志记录回调函数"""
        self._log_callback = callback
    
    def set_agent_id(self, agent_id: Optional[str]):
        """设置当前Agent ID（用于日志记录）"""
        self._current_agent_id = agent_id
    
    async def _chat_openai(
        self,
        messages: List[Message],
        model: str,
        temperature: float,
        max_tokens: Optional[int],
        **kwargs,
    ) -> ChatResponse:
        """OpenAI协议聊天"""
        request_body = {
            "model": model,
            "messages": [msg.to_dict() for msg in messages],
            "temperature": temperature,
        }
        if max_tokens:
            request_body["max_tokens"] = max_tokens
        request_body.update(kwargs)
        
        response = await self._client.post(
            f"{self.api_base}/chat/completions",
            json=request_body,
        )
        response.raise_for_status()
        data = response.json()
        
        choices = data.get("choices", [])
        if not choices:
            raise LLMError("API响应中没有choices")
        
        choice = choices[0]
        content = choice.get("message", {}).get("content", "")
        
        return ChatResponse(
            content=content,
            model=data.get("model", model),
            usage=data.get("usage"),
            finish_reason=choice.get("finish_reason"),
        )
    
    async def _chat_anthropic(
        self,
        messages: List[Message],
        model: str,
        temperature: float,
        max_tokens: Optional[int],
        **kwargs,
    ) -> ChatResponse:
        """Anthropic协议聊天"""
        # 分离system消息
        system_content = ""
        chat_messages = []
        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                chat_messages.append({"role": msg.role, "content": msg.content})
        
        request_body = {
            "model": model,
            "messages": chat_messages,
            "max_tokens": max_tokens or 4096,
        }
        if system_content:
            request_body["system"] = system_content
        if temperature != 0.7:
            request_body["temperature"] = temperature
        
        response = await self._client.post(
            f"{self.api_base}/v1/messages",
            json=request_body,
        )
        response.raise_for_status()
        data = response.json()
        
        content_blocks = data.get("content", [])
        content = ""
        for block in content_blocks:
            if block.get("type") == "text":
                content += block.get("text", "")
        
        return ChatResponse(
            content=content,
            model=data.get("model", model),
            usage=data.get("usage"),
            finish_reason=data.get("stop_reason"),
        )
    
    async def _chat_gemini(
        self,
        messages: List[Message],
        model: str,
        temperature: float,
        max_tokens: Optional[int],
        **kwargs,
    ) -> ChatResponse:
        """Gemini协议聊天"""
        # 转换消息格式
        contents = []
        system_instruction = None
        
        for msg in messages:
            if msg.role == "system":
                system_instruction = msg.content
            else:
                role = "user" if msg.role == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg.content}]
                })
        
        request_body = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
            }
        }
        if max_tokens:
            request_body["generationConfig"]["maxOutputTokens"] = max_tokens
        if system_instruction:
            request_body["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        
        url = f"{self.api_base}/models/{model}:generateContent"
        if self.api_key:
            url += f"?key={self.api_key}"
        
        response = await self._client.post(url, json=request_body)
        response.raise_for_status()
        data = response.json()
        
        candidates = data.get("candidates", [])
        if not candidates:
            raise LLMError("API响应中没有candidates")
        
        content = ""
        parts = candidates[0].get("content", {}).get("parts", [])
        for part in parts:
            content += part.get("text", "")
        
        return ChatResponse(
            content=content,
            model=model,
            usage=data.get("usageMetadata"),
            finish_reason=candidates[0].get("finishReason"),
        )
    
    async def chat_simple(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        **kwargs,
    ) -> str:
        """简化的聊天接口"""
        messages = []
        if system_prompt:
            messages.append(Message(role="system", content=system_prompt))
        messages.append(Message(role="user", content=prompt))
        
        response = await self.chat(messages, model=model, **kwargs)
        return response.content
    
    async def close(self):
        """关闭客户端"""
        await self._client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# 保持向后兼容的别名
LLMClient = MultiProtocolLLMClient
