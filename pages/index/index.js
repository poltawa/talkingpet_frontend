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
    isGenerating: false,
    // isFirstLoad: true,
    scrollIntoView: '',  // 新增
    hasMore: true,    // 是否还有更多历史消息
    isLoadingHis: false,  // 是否正在加载历史消息    
    // isRefreshing: false,
    hasUploadedImage: false, // 是否已上传图片
    isInputFocused: false, // 输入框是否获得焦点
    keyboardHeight: 0, // 键盘高度
  },

  onLoad() {
    // this.initializeData();
    // 显示欢迎消息
    // this.setData({
    //   showWelcomeToast: true,
    //   // isFirstLoad: true,
    //   hasUploadedImage: false
    // });
    
    // 监听键盘高度变化
    wx.onKeyboardHeightChange(res => {
      if (res.height > 0 && this.data.isInputFocused) {
        // 键盘弹出，调整输入框位置
        this.setData({
          keyboardHeight: res.height
        });
        
        // 给布局调整留时间，然后滚动到底部
        setTimeout(() => {
          this.scrollToBottom();
        }, 200);
      } else {
        // 键盘收起
        this.setData({
          keyboardHeight: 0
        });
      }
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
    // 获取缓存的sessionId
    // const storedSessionId = wx.getStorageSync('sessionId');
    
    // if (storedSessionId) {
    //   this.setData({
    //     sessionId: storedSessionId
    //   });
    // }
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

  // 发送消息到后端
  async sendMessageToBackend(userMessage) {
    // userMessage args object: type: 'image' or 'text',   content: 文本or FILEID, isPortrait: 1 or 0
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
          fileID: uploadResult.fileID,
          isPortrait: userMessage.isPortrait
        };
        console.log(requestData);
      } else {
        // 如果是文本消息
        requestData = {
          type: 'text',
          content: userMessage.content,
          isPortrait: null
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

  onInputFocus() {
    this.setData({
      isInputFocused: true
    });
    
    // 如果onKeyboardHeightChange还没触发，使用估计值
    if (this.data.keyboardHeight === 0) {
      wx.getSystemInfo({
        success: (res) => {
          // 估计键盘高度为屏幕高度的1/3
          const estimatedKeyboardHeight = res.windowHeight / 3;
          this.setData({
            keyboardHeight: estimatedKeyboardHeight
          });
        }
      });
    }
    
    // 给布局调整留时间，然后滚动到底部
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },

  onInputBlur() {
    this.setData({
      isInputFocused: false
    });
  },

  sendTextMessage() {
    if (this.data.isGenerating) {
      wx.showToast({
        title: '你慢点说 !',
        // icon: 'none'
        image: '../../images/wait.png',
      });
      return;
    }
    const content = this.data.inputValue.trim();
    if (!content || !this.data.hasUploadedImage) {
      return;
    }
    console.log('发送前 inputValue:', this.data.inputValue);
    // 清空输入框
    this.setData({ 
      inputValue: ''
    });
    console.log('清空后 inputValue:', this.data.inputValue);
    wx.nextTick(() => {
      // 添加用户消息到列表
      this.updateMessages('text', 'user', content);
  
      // 发送到后端
      this.sendMessageToBackend({
        type: 'text',
        content: content
      });
    });
    // 添加用户消息到列表
    // this.sendMessage('text', content);
    // this.updateMessages('text', 'user', content);

    // // 发送到后端
    // this.sendMessageToBackend({
    //   type: 'text',
    //   content: content
    // });
  },

  sendImageMessage() {
    if (this.data.isGenerating) {
      wx.showToast({
        title: '你慢点说 !',
        image: '../../images/wait.png',
      });
      return;
    }
  
    let tempFilePath;
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })
    .then(res => {
      tempFilePath = res.tempFilePaths[0];
      // 返回一个新的Promise
      return new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: tempFilePath,
          success(res) {
            if (res.size > 10 * 1024 * 1024) {
              wx.showToast({
                title: '图片大小不能超过10MB',
                icon: 'none'
              });
              reject(new Error('图片过大'));
              return;
            }
            const isPortrait = res.height > res.width;
            console.log('isPortrait', isPortrait);
            resolve(isPortrait);
          },
          fail(err) {
            console.error('获取图片信息失败：', err);
            reject(err);
          }
        });
      });
    })
    .then(isPortrait => {
      this.setData({
        hasUploadedImage: true
      });
      
      // 添加用户图片消息到列表
      this.updateMessages('image', 'user', tempFilePath, isPortrait);
      
      // 发送到后端
      this.sendMessageToBackend({
        type: 'image',
        content: tempFilePath,
        isPortrait: isPortrait
      });
    })
    .catch(error => {
      if (error.message !== '图片过大') {
        console.error('处理图片失败：', error);
      }
    });
  },


  updateMessages(type, who_said, content, isPortrait) {
    const message = {
      message_type: type,
      who_said,
      message_content: content,
      time: formatCurrentTime(), // 使用已调整的时间
      isPortrait: isPortrait
    };
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
    // this.setData({ isLoadingHis: true });
    if (this._pullDownThrottle) {
      this._pullDownThrottle();
      return;
    }
    
    this._pullDownThrottle = throttle(async () => {
      await this.loadHistoryMessages();
      this.setData({ isLoadingHis: false });
      wx.stopPullDownRefresh();
    }, 1000);
    
    this._pullDownThrottle();
  },


// 从服务器加载历史消息
async loadHistoryMessages() {
  console.log('触发下拉刷新');
  
  // 如果正在加载，直接返回
  if (this.data.isLoadingHis) return;
  
  this.setData({ isLoadingHis: true });
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
        ...msg
      }));
      // console.log(currentMessages)
      console.log(newMessages)

      const currentMessages = this.data.messages;
      const updatedMessages = [...newMessages, ...currentMessages];

      console.log(updatedMessages)
        // 内存中保留所有加载的消息
      this.setData({
        messages: updatedMessages,
        hasMore: res.data.hasMore,
        // isFirstLoad: false,
        isLoadingHis: false,
      });
    }
  } catch (error) {
    console.error('加载历史消息失败:', error);
    wx.showToast({
      title: '加载失败',
      icon: 'none'
    });
  } 
},

  // 监听页面尺寸变化
  onResize(res) {
    // 页面尺寸变化时滚动到底部（例如键盘弹出/收起）
    this.scrollToBottom();
  }
})