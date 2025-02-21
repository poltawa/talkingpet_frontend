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
    // 生成新的会话ID
    this.globalData.sessionId = this.generateSessionId();
  }
})
