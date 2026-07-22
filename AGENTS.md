# FitPocket 开发规则

核心流程：点身体 → 点表情 → 自动完成。只记录 `bodyArea`、`intensity`、`date`、`createdAt`、`updatedAt`。

- 原生微信小程序，TypeScript + WXML + WXSS。
- 页面通过 Repository 访问存储，业务规则写成纯函数。
- 禁止增加运动类型、时长、重量、卡路里、目标、积分、登录、提醒和云服务。
- 修改后运行 `npm run typecheck`、`npm test`、`git diff --check`。
- 不擅自提交或推送。
