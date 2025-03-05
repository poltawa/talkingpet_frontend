import { config } from "../../config/index.js";
import { formatCurrentTime } from "../../utils/dateUtil.js";

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
  onHide() {
    wx.setStorageSync('recentMessages', this.data.messages.slice(-50));
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
    // userMessage args object: type: 'image' or 'text',   content: 文本or FILEID
    // 
    // let messageIndex;
    try {
      // 设置生成状态
      this.setData({ isGenerating: true });

      let requestData;
      console.log(userMessage);
      if (userMessage.type === 'image') {  
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
                    fullContent += eventData.content;
                    
                    // 如果是第一次收到内容，创建新消息
                    // if (messageIndex === undefined) {                  
                    //   this.addMessage('assistant', '');
                    //   messageIndex = this.data.messages.length - 1;
                    // }

                    
                    
                    // 更新现有消息
                    // const messages = this.data.messages;
                    // messages[messageIndex].content = fullContent;
                    // this.setData({ messages });

                    // // 确保滚动到最新消息
                    // this.scrollToBottom();
                  }
                } catch (e) {
                  console.warn('解析SSE数据失败:', e);
                }
              }
            }
            this.updateMessages('text', 'system', fullContent);
            console.log('tupian huaile daan', this.data.messages[this.data.messages.length-1].isPortrait, this.data.messages[this.data.messages.length-1].content);
            resolve();
          },
          fail: reject
        });
      });

    } catch (error) {
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
    // this.sendMessage('text', content);
    this.updateMessages('text', 'user', content);

    // 发送到后端
    this.sendMessageToBackend({
      type: 'text',
      content: content
    });
  },

  sendImageMessage() {
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
      // console.log(tempFilePath);
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
        this.updateMessages('image', 'user', tempFilePath);        
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

  


  // updateMessages(type, who_said, content) {
  //   const message = {
  //     type,
  //     who_said,
  //     content,
  //     // isUser: role === 'assistant' ? false : true,
  //     // timestamp: Date.now()      
  //     time: formatTimestamp(Date.now()),
  //     isPortrait: null
  //   };
  //   if (type === 'image') {
  //     wx.getImageInfo({
  //       src: content,
  //       success: (res) => {
  //         const isPortrait = res.height > res.width;
  //         console.log('isPortrait',isPortrait)
  //         message.isPortrait = isPortrait;
  //       },
  //       fail: (err) => {
  //         console.error('获取图片信息失败：', err);
  //       }
  //     });
  //   }
  //   const newMessages = [...this.data.messages, message];
  //   this.setData({
  //     messages: newMessages
  //   }, () => {
  //     wx.nextTick(() => {
  //       this.scrollToBottom();
  //     });
  //   });
  //   // console.log(this.data.messages[-1])
  //   console.log('tupian huaile', this.data.messages[this.data.messages.length-1].isPortrait, this.data.messages[this.data.messages.length-1].content);
  // },


  updateMessages(type, who_said, content) {
    const message = {
      type,
      who_said,
      content,
      // time: formatTimestamp(Date.now()),
      time: formatCurrentTime(), // 使用已调整的时间
      isPortrait: null
    };
    
    // 使用条件判断和Promise，不创建额外函数
    (type === 'image' 
      ? new Promise((resolve) => {
          wx.getImageInfo({
            src: content,
            success: (res) => {
              const isPortrait = res.height > res.width;
              console.log('isPortrait', isPortrait);
              message.isPortrait = isPortrait;
              resolve();
            },
            fail: (err) => {
              console.error('获取图片信息失败：', err);
              resolve(); // 即使失败也继续
            }
          });
        })
      : Promise.resolve()
    ).then(() => {
      const newMessages = [...this.data.messages, message];
      this.setData({
        messages: newMessages
      }, () => {
        wx.nextTick(() => {
          this.scrollToBottom();
        });
      });
      // console.log(this.data.messages[-1]);
      console.log('tupian huaile', this.data.messages[this.data.messages.length-1].isPortrait, this.data.messages[this.data.messages.length-1].content);
    });
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
        content:  msg.content,  
        who_said: msg.role 
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