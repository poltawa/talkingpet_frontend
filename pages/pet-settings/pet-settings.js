Page({
  data: {
    petTypes: ['猫', '狗', '兔子', '鸟', '其他'],
    personalities: ['活泼', '安静', '粘人', '独立', '其他'],
    habits: ['爱玩', '爱睡', '爱吃', '爱运动', '其他'],
    selectedType: '',
    selectedPersonality: '',
    selectedHabit: '',
    customType: '',
    customPersonality: '',
    customHabit: '',
    showCustomType: false,
    showCustomPersonality: false,
    showCustomHabit: false,
    isSaving: false,
    formErrors: {
      type: '',
      personality: '',
      habit: ''
    }
  },

  onLoad() {
    this.loadExistingSettings();
  },

  // 加载已有的宠物设置
  async loadExistingSettings() {
    try {
      const res = await wx.cloud.database().collection('pet_settings')
        .where({
          _openid: wx.getStorageSync('openid')
        })
        .orderBy('createTime', 'desc')
        .limit(1)
        .get();

      if (res.data.length > 0) {
        const settings = res.data[0];
        this.setData({
          selectedType: settings.petType,
          selectedPersonality: settings.personality,
          selectedHabit: settings.habit,
          showCustomType: !this.data.petTypes.includes(settings.petType),
          showCustomPersonality: !this.data.personalities.includes(settings.personality),
          showCustomHabit: !this.data.habits.includes(settings.habit),
          customType: !this.data.petTypes.includes(settings.petType) ? settings.petType : '',
          customPersonality: !this.data.personalities.includes(settings.personality) ? settings.personality : '',
          customHabit: !this.data.habits.includes(settings.habit) ? settings.habit : ''
        });
      }
    } catch (error) {
      console.error('加载设置失败：', error);
      wx.showToast({
        title: '加载设置失败',
        icon: 'none'
      });
    }
  },

  // 选择宠物类型
  onTypeChange(e) {
    const selected = this.data.petTypes[e.detail.value];
    if (selected === '其他') {
      this.setData({
        showCustomType: true,
        selectedType: '',
        formErrors: {
          ...this.data.formErrors,
          type: ''
        }
      });
    } else {
      this.setData({
        selectedType: selected,
        showCustomType: false,
        customType: '',
        formErrors: {
          ...this.data.formErrors,
          type: ''
        }
      });
    }
  },

  // 选择性格
  onPersonalityChange(e) {
    const selected = this.data.personalities[e.detail.value];
    if (selected === '其他') {
      this.setData({
        showCustomPersonality: true,
        selectedPersonality: '',
        formErrors: {
          ...this.data.formErrors,
          personality: ''
        }
      });
    } else {
      this.setData({
        selectedPersonality: selected,
        showCustomPersonality: false,
        customPersonality: '',
        formErrors: {
          ...this.data.formErrors,
          personality: ''
        }
      });
    }
  },

  // 选择习惯
  onHabitChange(e) {
    const selected = this.data.habits[e.detail.value];
    if (selected === '其他') {
      this.setData({
        showCustomHabit: true,
        selectedHabit: '',
        formErrors: {
          ...this.data.formErrors,
          habit: ''
        }
      });
    } else {
      this.setData({
        selectedHabit: selected,
        showCustomHabit: false,
        customHabit: '',
        formErrors: {
          ...this.data.formErrors,
          habit: ''
        }
      });
    }
  },

  // 输入自定义类型
  onCustomTypeInput(e) {
    this.setData({
      customType: e.detail.value.trim(),
      formErrors: {
        ...this.data.formErrors,
        type: ''
      }
    });
  },

  // 输入自定义性格
  onCustomPersonalityInput(e) {
    this.setData({
      customPersonality: e.detail.value.trim(),
      formErrors: {
        ...this.data.formErrors,
        personality: ''
      }
    });
  },

  // 输入自定义习惯
  onCustomHabitInput(e) {
    this.setData({
      customHabit: e.detail.value.trim(),
      formErrors: {
        ...this.data.formErrors,
        habit: ''
      }
    });
  },

  // 验证表单
  validateForm() {
    const errors = {
      type: '',
      personality: '',
      habit: ''
    };

    const petType = this.data.showCustomType ? this.data.customType : this.data.selectedType;
    const personality = this.data.showCustomPersonality ? this.data.customPersonality : this.data.selectedPersonality;
    const habit = this.data.showCustomHabit ? this.data.customHabit : this.data.selectedHabit;

    if (!petType) {
      errors.type = '请选择或输入宠物类型';
    }
    if (!personality) {
      errors.personality = '请选择或输入宠物性格';
    }
    if (!habit) {
      errors.habit = '请选择或输入宠物习惯';
    }

    this.setData({ formErrors: errors });

    return !errors.type && !errors.personality && !errors.habit;
  },

  // 保存设置
  async saveSettings() {
    if (this.data.isSaving) return;

    if (!this.validateForm()) {
      wx.showToast({
        title: '请完善所有信息',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSaving: true });
    wx.showLoading({ title: '保存中...' });

    try {
      const petType = this.data.showCustomType ? this.data.customType : this.data.selectedType;
      const personality = this.data.showCustomPersonality ? this.data.customPersonality : this.data.selectedPersonality;
      const habit = this.data.showCustomHabit ? this.data.customHabit : this.data.selectedHabit;

      await wx.cloud.database().collection('pet_settings').add({
        data: {
          petType,
          personality,
          habit,
          createTime: new Date()
        }
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

    } catch (error) {
      console.error('保存设置失败：', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isSaving: false });
      wx.hideLoading();
    }
  },

  // 跳过设置
  skipSettings() {
    wx.showModal({
      title: '提示',
      content: '确定要跳过设置吗？这可能会影响宠物的个性化表现。',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  },

  // 返回上一页
  goBack() {
    if (this.hasChanges()) {
      wx.showModal({
        title: '提示',
        content: '您有未保存的更改，确定要离开吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 检查是否有未保存的更改
  hasChanges() {
    const petType = this.data.showCustomType ? this.data.customType : this.data.selectedType;
    const personality = this.data.showCustomPersonality ? this.data.customPersonality : this.data.selectedPersonality;
    const habit = this.data.showCustomHabit ? this.data.customHabit : this.data.selectedHabit;

    return petType || personality || habit;
  }
});
