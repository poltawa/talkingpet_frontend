import { config } from "../../config/index.js";
import { formatTimestamp } from "../../utils/dateUtil.js";

// 节流函数
function throttle(func, delay) {
  let timer = null;
  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        func.apply(this, args);
        timer = null;
      }, delay);
    }
  };
}

Page({
  data: {
    messages: [],
    inputValue: '',
    showInput: true,
    isGenerating: false,
    isFirstLoad: true,
    scrollIntoView: '',  // 新增
    hasMore: true,    // 是否还有更多历史消息
    isLoading: false,  // 是否正在加载历史消息    
    isRefreshing: false,
  },

  onLoad() {
    // this.initializeData();
    // 显示欢迎消息
    this.setData({
      showWelcomeToast: true,
      welcomeMessage: '铲屎的又回来了'
    });
    

    // 首先加载本地缓存的最近消息
    this.loadLocalMessages();
    
    // 然后异步加载第一页数据
    // this.loadHistoryMessages();

  },

  onReady() {
    // 从后台恢复时不需要特殊处理
    // this.scrollToBottom();
    // this.loadLocalMessages();
  },
  onShow() {
    // 从后台恢复时不需要特殊处理
    // this.scrollToBottom();
  },

  // onReachUpper() {
  //   if (!this.data.hasMore || this.data.isLoading) return;
    
  //   this.setData({ loadingMore: true });
  //   this.loadHistoryMessages().then(() => {
  //     this.setData({ loadingMore: false });
  //   });
  // },

  // 发送消息到后端
  async sendMessageToBackend(userMessage) {
    let messageIndex;
    try {
      // 设置生成状态
      this.setData({ isGenerating: true });

      let requestData;
      if (userMessage.type === 'image') {
        // 如果是图片消息，上传到云存储
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `images/${Date.now()}.jpg`,
          filePath: userMessage.content,
          config: {
            env: config.WX_ENV_ID
          }
        });

        console.log('图片上传成功，fileID:', uploadResult.fileID);
        requestData = {
          type: 'image',
          fileID: uploadResult.fileID
        };
      } else {
        // 如果是文本消息
        requestData = {
          type: 'text',
          content: userMessage.content
        };
      }

      // 设置请求头
      const header = {
        'content-type': 'application/json',
        'Accept': 'text/event-stream',
        'X-WX-SERVICE': config.WX_SERVICE_NAME,
        'X-Session-ID': getApp().globalData.sessionId // 使用全局会话ID
      };
      
      let fullContent = '';

      // 发送请求并处理流式响应
      await new Promise((resolve, reject) => {
        wx.cloud.callContainer({
          config: {
            env: config.WX_ENV_ID
          },
          path: '/api/analyze',
          header: header,
          method: 'POST',
          data: requestData,
          dataType: '',  // 不要解析响应
          responseType: 'text',
          success: (res) => {
            if (res.statusCode !== 200) {
              reject(new Error('请求失败: ' + res.statusCode));
              return;
            }

            // 处理SSE响应
            const lines = res.data.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));
                  if (eventData.success && eventData.content) {
                    // 如果是第一次收到内容，创建新消息
                    if (messageIndex === undefined) {                  
                      this.addMessage('assistant', '');
                      messageIndex = this.data.messages.length - 1;
                    }

                    fullContent += eventData.content;
                    
                    // 更新现有消息
                    const messages = this.data.messages;
                    messages[messageIndex].content = fullContent;
                    this.setData({ messages });

                    // 确保滚动到最新消息
                    this.scrollToBottom();
                  }
                } catch (e) {
                  console.warn('解析SSE数据失败:', e);
                }
              }
            }
            resolve();
          },
          fail: reject
        });
      });

    } catch (error) {
      if (messageIndex === undefined) {
        this.addMessage('assistant', '抱歉，处理您的消息时出现了错误');
        messageIndex = this.data.messages.length - 1;
      }
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none',
        duration: 2000
      });
      console.error('发送失败：', error);
    } finally {
      this.setData({ isGenerating: false });
    }
  },

  // 加载本地缓存的消息
  loadLocalMessages() {
    const recentMessages = wx.getStorageSync('recentMessages') || [];
    console.log('recentMessages bendi', recentMessages);
    this.setData({ 
      messages: recentMessages
    }, () => {
      setTimeout(() => {
        this.scrollToBottom();
        console.log('scroll bendi');
      }, 1000);
    });
  },


  // loadLocalMessages() {
  //   const recentMessages = wx.getStorageSync('recentMessages') || [];
  //   console.log('recentMessages bendi', recentMessages);
    
  //   // 先设置消息数据
  //   this.setData({ 
  //     messages: recentMessages
  //   }, () => {
  //     // 等待一个非常短的时间，确保消息元素已渲染
  //     wx.nextTick(() => {
  //       if (recentMessages.length > 0) {
  //         const lastIndex = recentMessages.length - 1;
  //         this.setData({
  //           scrollIntoView: `msg-${lastIndex}`
  //         });
  //       }
  //     });
  //   });
  // },

  



  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  sendTextMessage() {
    const content = this.data.inputValue.trim();
    if (!content) {
      return;
    }

    // 清空输入框
    this.setData({ 
      inputValue: '',
      showInput: true  // 确保输入框保持显示
    });

    // 添加用户消息到列表
    this.sendMessage('text', content);

    // 发送到后端
    this.sendMessageToBackend({
      type: 'text',
      content: content
    });
  },

  uploadImage() {
    if (this.data.isUploading) {
      wx.showToast({
        title: '请等待当前操作完成',
        icon: 'none'
      });
      return;
    }

    this.setData({ isUploading: true });

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    }).then(res => {
      const tempFilePath = res.tempFilePaths[0];
      
      // 检查文件大小
      wx.getFileInfo({
        filePath: tempFilePath
      }).then(fileInfo => {
        if (fileInfo.size > 10 * 1024 * 1024) { // 10MB限制
          wx.showToast({
            title: '图片大小不能超过10MB',
            icon: 'none'
          });
          return;
        }

        // 添加用户图片消息到列表
        this.sendMessage('image', {
          tempPath: tempFilePath,
          // timestamp: Date.now()
          time: formatTimestamp(Date.now())
        });

        // 发送到后端
        this.sendMessageToBackend({
          type: 'image',
          content: tempFilePath
        });
      }).catch(error => {
        console.error('获取文件信息失败：', error);
      });
    }).catch(error => {
      console.error('上传失败：', error);
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ isUploading: false });
    });
  },

  sendMessage(type, content) {
    // 检查发送间隔（1秒）
    // const now = Date.now();
    const now = formatTimestamp(Date.now());
    
    if (now - this.data.lastSendTime < 1000) {
      wx.showToast({
        title: '发送太频繁',
        icon: 'none'
      });
      return;
    }

    const message = {
      type,
      content,
      isUser: true,
      time: now
    };
  
    if (type === 'image') {
      wx.getImageInfo({
        src: content.tempPath,
        success: (res) => {
          const isPortrait = res.height > res.width;
          message.isPortrait = isPortrait;
          this.updateMessages(message);
        },
        fail: (err) => {
          console.error('获取图片信息失败：', err);
          this.updateMessages(message);
        }
      });
    } else {
      this.updateMessages(message);
    }
    // this.scrollToBottom();
    this.setData({ lastSendTime: now });
  },

  updateMessages(message) {
    const messages = [...this.data.messages, message];
    this.setData({ messages }, () => {
      wx.nextTick(() => {
        this.scrollToBottom();
      });
    });
    console.log('updateMessages', messages);
    // 更新本地存储（只存储最近50条）
    wx.setStorageSync('recentMessages', messages.slice(-50));
  },

  addMessage(role, content) {
    const message = {
      type: 'text',
      content,
      isUser: role === 'assistant' ? false : true,
      // timestamp: Date.now()      
      time: formatTimestamp(Date.now())
    };

    const newMessages = [...this.data.messages, message];
    this.setData({
      messages: newMessages,
      isGenerating: false,
      streamingText: ''
    });

    // 更新本地存储（只存储最近50条）
    wx.setStorageSync('recentMessages', newMessages.slice(-50));
  },

  scrollToBottom() {
    if (this.data.messages.length === 0) return;
    
    const lastIndex = this.data.messages.length - 1;
    this.setData({
      scrollIntoView: `msg-${lastIndex}`
    });
  },


  onPullDownRefresh: function() {
    console.log('触发onPullDownRefresh');
    this.setData({ isRefreshing: true });
    if (this._pullDownThrottle) {
      this._pullDownThrottle();
      return;
    }
    
    this._pullDownThrottle = throttle(async () => {
      await this.loadHistoryMessages();
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    }, 1000);
    
    this._pullDownThrottle();
  },


// 从服务器加载历史消息
async loadHistoryMessages() {
  console.log('触发下拉刷新');
  
  // 如果正在加载，直接返回
  if (this.data.isLoading) return;
  
  this.setData({ isLoading: true });
  try {
    // console.log(this.data.messages);
    console.log(this.data.messages[0].time);
    const res = await wx.cloud.callContainer({
      config: {
        env: config.WX_ENV_ID
      },
      path: '/api/messages',
      method: 'GET',
      header: {
        'X-WX-SERVICE': config.WX_SERVICE_NAME,
        'content-type': 'application/json'
      },
      data: {
        last_time: this.data.messages[0].time
      }
    });
    console.log(res)
    if (res.statusCode === 200) {
      // 处理消息格式
      const newMessages = res.data.messages.map(msg => ({
        ...msg,
        content: msg.type === 'image' ? {
          tempPath: msg.content  // 如果是图片，把fileID放到tempPath中
        } : msg.content,  // 如果是文本，直接使用content
        isUser: msg.role === 'user'  // 添加isUser标志
      }));
      // console.log(currentMessages)
      console.log(newMessages)

      const currentMessages = this.data.messages;
      // const updatedMessages = this.data.isFirstLoad 
      //   ? newMessages 
      //   : [...newMessages, ...currentMessages];
      const updatedMessages = [...newMessages, ...currentMessages];

      console.log(updatedMessages)
        // 内存中保留所有加载的消息
      this.setData({
        messages: updatedMessages,
        hasMore: res.data.hasMore,
        isFirstLoad: false,
        isLoading: false,
      });




      // 只在首次加载时更新本地存储，且只存储最新的50条
      // if (this.data.isFirstLoad && newMessages.length > 0) {
      //   wx.setStorageSync('recentMessages', newMessages.slice(-50));
      // }
    }
  } catch (error) {
    console.error('加载历史消息失败:', error);
    wx.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } 
},
});
