// 小程序配置
export const config = {
  // 微信云托管环境ID
  WX_ENV_ID: 'prod-1gsorqx43afb99f8',
  // 云托管服务名
  WX_SERVICE_NAME: 'flask-9uml',
  // 图片上传配置
  IMAGE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  },
  // 消息加载配置
  MESSAGE: {
    PAGE_SIZE: 20,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // ms
  }
};
