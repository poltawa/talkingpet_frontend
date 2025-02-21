Page({
  data: {
    userInfo: {},
    petSettings: null,
    chatHistory: [],
    searchKeyword: '',
    currentPage: 1,
    pageSize: 20,
    hasMore: true,
    isLoading: false,
    filteredHistory: []
  },

  onLoad() {
    this.loadUserInfo();
    this.loadPetSettings();
    this.loadChatHistory();
  },

  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      hasMore: true,
      chatHistory: []
    });
    this.loadChatHistory(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreHistory();
    }
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ userInfo });
        return;
      }

      // 如果没有缓存的用户信息，则重新获取
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          const userInfo = res.userInfo;
          this.setData({ userInfo });
          wx.setStorageSync('userInfo', userInfo);
        },
        fail: (err) => {
          console.error('获取用户信息失败：', err);
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      console.error('加载用户信息失败：', error);
    }
  },

  // 加载宠物设置
  async loadPetSettings() {
    try {
      const res = await wx.cloud.database().collection('pet_settings')
        .where({
          _openid: wx.getStorageSync('openid')
        })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get();

      if (res.data.length > 0) {
        this.setData({
          petSettings: res.data[0]
        });
      }
    } catch (error) {
      console.error('加载宠物设置失败：', error);
      wx.showToast({
        title: '加载宠物设置失败',
        icon: 'none'
      });
    }
  },

  // 加载聊天历史
  async loadChatHistory(callback) {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    try {
      const db = wx.cloud.database();
      const res = await db.collection('chat_history')
        .where({
          _openid: wx.getStorageSync('openid')
        })
        .orderBy('timestamp', 'desc')
        .skip((this.data.currentPage - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get();

      const newHistory = this.data.currentPage === 1 ? 
        res.data : 
        [...this.data.chatHistory, ...res.data];

      this.setData({
        chatHistory: newHistory,
        hasMore: res.data.length === this.data.pageSize,
        filteredHistory: this.filterHistory(newHistory, this.data.searchKeyword)
      });
    } catch (error) {
      console.error('加载聊天历史失败：', error);
      wx.showToast({
        title: '加载聊天历史失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
      callback && callback();
    }
  },

  // 加载更多历史记录
  loadMoreHistory() {
    if (!this.data.hasMore || this.data.isLoading) return;
    
    this.setData({
      currentPage: this.data.currentPage + 1
    }, () => {
      this.loadChatHistory();
    });
  },

  // 搜索历史对话
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      filteredHistory: this.filterHistory(this.data.chatHistory, keyword)
    });
  },

  // 过滤历史记录
  filterHistory(history, keyword) {
    if (!keyword) return history;
    
    const lowerKeyword = keyword.toLowerCase();
    return history.filter(item => {
      // 搜索消息内容
      const content = item.content ? item.content.toLowerCase() : '';
      // 搜索时间
      const time = new Date(item.timestamp).toLocaleString().toLowerCase();
      return content.includes(lowerKeyword) || time.includes(lowerKeyword);
    });
  },

  // 清空搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      filteredHistory: this.data.chatHistory
    });
  },

  // 修改宠物设置
  editPetSettings() {
    wx.navigateTo({
      url: '/pages/pet-settings/pet-settings'
    });
  },

  // 返回聊天页面
  goBack() {
    wx.navigateBack();
  },

  // 删除历史记录
  async deleteHistory(e) {
    const { id } = e.currentTarget.dataset;
    
    try {
      await wx.showModal({
        title: '提示',
        content: '确定要删除这条记录吗？',
        success: async (res) => {
          if (res.confirm) {
            await wx.cloud.database().collection('chat_history').doc(id).remove();
            
            // 更新本地数据
            const newHistory = this.data.chatHistory.filter(item => item._id !== id);
            this.setData({
              chatHistory: newHistory,
              filteredHistory: this.filterHistory(newHistory, this.data.searchKeyword)
            });

            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
          }
        }
      });
    } catch (error) {
      console.error('删除历史记录失败：', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  }
});
