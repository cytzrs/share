import React from 'react';
import {
  OpenAI,
  Claude,
  Gemini,
  Mistral,
  Meta,
  Qwen,
  DeepSeek,
  Zhipu,
  Baichuan,
  Yi,
  OpenRouter,
  Ollama,
  HuggingFace,
  Cohere,
  Perplexity,
} from '@lobehub/icons';

interface ModelIconProps {
  modelName: string;
  size?: number;
}

/**
 * 根据模型名称显示对应的图标
 */
export const ModelIcon: React.FC<ModelIconProps> = ({ modelName, size = 20 }) => {
  const name = modelName.toLowerCase();
  
  // OpenAI 系列
  if (name.includes('gpt') || name.includes('openai') || name.includes('o1') || name.includes('o3')) {
    return <OpenAI.Avatar size={size} />;
  }
  
  // Claude 系列
  if (name.includes('claude') || name.includes('anthropic')) {
    return <Claude.Color size={size} />;
  }
  
  // Gemini 系列
  if (name.includes('gemini') || name.includes('google')) {
    return <Gemini.Color size={size} />;
  }
  
  // Mistral 系列
  if (name.includes('mistral') || name.includes('mixtral')) {
    return <Mistral.Color size={size} />;
  }
  
  // Meta/Llama 系列
  if (name.includes('llama') || name.includes('meta')) {
    return <Meta.Color size={size} />;
  }
  
  // 通义千问
  if (name.includes('qwen') || name.includes('tongyi') || name.includes('通义')) {
    return <Qwen.Color size={size} />;
  }
  
  // DeepSeek
  if (name.includes('deepseek')) {
    return <DeepSeek.Color size={size} />;
  }
  
  // 智谱
  if (name.includes('glm') || name.includes('zhipu') || name.includes('智谱') || name.includes('chatglm')) {
    return <Zhipu.Color size={size} />;
  }
  
  // 百川
  if (name.includes('baichuan') || name.includes('百川')) {
    return <Baichuan.Color size={size} />;
  }
  
  // Yi/零一万物
  if (name.includes('yi-') || name.includes('yi/')) {
    return <Yi.Color size={size} />;
  }
  
  // OpenRouter
  if (name.includes('openrouter')) {
    return <OpenRouter.Avatar size={size} shape="square" />;
  }
  
  // Ollama
  if (name.includes('ollama')) {
    return <Ollama size={size} />;
  }
  
  // HuggingFace
  if (name.includes('huggingface') || name.includes('hf/')) {
    return <HuggingFace.Color size={size} />;
  }
  
  // Cohere
  if (name.includes('cohere') || name.includes('command')) {
    return <Cohere.Color size={size} />;
  }
  
  // Perplexity
  if (name.includes('perplexity') || name.includes('pplx')) {
    return <Perplexity.Color size={size} />;
  }
  
  // 默认使用 OpenAI 图标
  return <OpenAI size={size} />;
};

export default ModelIcon;
