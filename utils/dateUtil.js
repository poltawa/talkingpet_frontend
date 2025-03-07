// utils/dateUtil.js
import { config } from "../config/index.js";

let timeOffset = 0;  // 存储时间偏移量

const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 同步服务器时间并计算偏移量
const syncTimeWithServer = () => {
  return new Promise((resolve, reject) => {
    const clientTime = Date.now();
    console.log('客户端时间：', clientTime);
    wx.cloud.callContainer({
      config: {
        env: config.WX_ENV_ID
      },
      path: '/api/serverTime',
      header: {
        'content-type': 'application/json',
        'X-WX-SERVICE': config.WX_SERVICE_NAME
      },
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          const serverTimeStr = res.data.server_time;
          const serverTime = new Date(serverTimeStr).getTime();
          console.log(serverTimeStr)
          // 计算偏移量 (服务器时间 - 客户端时间)
          timeOffset = serverTime - clientTime;
          
          console.log('时间偏移量(毫秒):', timeOffset);
          resolve(timeOffset);
        } else {
          reject(new Error('获取服务器时间失败'));
        }
      },
      fail: (err) => {
        console.error('同步时间失败，详细错误:', JSON.stringify(err));
        // 输出更多调试信息
        console.error('请求环境:', config.WX_ENV_ID);
        console.error('请求服务:', config.WX_SERVICE_NAME);
        console.error('请求路径:', '/api/serverTime');
        reject(err);
      }
    });
  });
};

// 获取调整后的时间戳
const getAdjustedTimestamp = () => {
  return Date.now() + timeOffset;
};

// 格式化调整后的当前时间
const formatCurrentTime = () => {
  return formatTimestamp(getAdjustedTimestamp());
};

module.exports = {
  formatTimestamp,
  syncTimeWithServer,
  getAdjustedTimestamp,
  formatCurrentTime
};