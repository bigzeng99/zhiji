export const AI_DEFAULTS = {
  endpoint: 'https://llm-43hjakkfhzs4caa5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions',
  key: 'sk-ws-H.EDMXMLR.Iy8B.MEQCIGcpAuO2fdqvsdsv5EnFbV5GLniAYiG1VLFn7NqcKa30AiBUm44F58oxsI6a9ajpJwb0vFdkWdFeJfrLyVFxyrIS4Q',
  model: 'glm-5.2'
}

export function getAiEndpoint() {
  return localStorage.getItem('zhiji_ai_endpoint') || AI_DEFAULTS.endpoint
}

export function getAiKey() {
  return localStorage.getItem('zhiji_ai_key') || AI_DEFAULTS.key
}

export function getAiModel() {
  return localStorage.getItem('zhiji_ai_model') || AI_DEFAULTS.model
}
