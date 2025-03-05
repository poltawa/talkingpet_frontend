import { syncTimeWithServer } from "./utils/dateUtil.js";

App({
  globalData: {
    sessionId: null
  },

  generateSessionId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  },

  async onLaunch() {
    // 使用callContainer前一定要init一下，全局执行一次即可
    wx.cloud.init();
    syncTimeWithServer().catch(err => {
      console.error('同步服务器时间失败:', err);
    });
    // 生成新的会话ID
    this.globalData.sessionId = this.generateSessionId();
  }
})
