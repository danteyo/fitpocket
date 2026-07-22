// app.ts
App<IAppOption>({
  globalData: {},
  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-d1gh395jt06f82473',
      traceUser: true,
    })
  },
})
