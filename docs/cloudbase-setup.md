# FitPocket CloudBase 部署说明

客户端只使用云环境 `cloudbase-d1gh395jt06f82473` 的微信身份，不需要也不得配置 AppSecret、SecretId 或 SecretKey。

## 1. 创建集合

在微信开发者工具的“云开发 → 数据库”中创建：

- `users`：用户昵称、头像地址及创建/更新时间；CloudBase 自动写入 `_openid`。
- `workouts`：只保存 `date`、`bodyArea`、`intensity`、`createdAt`、`updatedAt`；CloudBase 自动写入 `_openid`。

## 2. 设置安全规则

两个集合均使用以下规则，确保文档只能由其微信身份所有者读写：

```json
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

不要使用“所有用户可读”或 `true` 规则。部署后应分别用两个微信测试账号确认：账号 A 无法查询、修改或删除账号 B 的文档。

## 3. 创建索引

在 `workouts` 创建唯一组合索引：

1. `_openid`：升序
2. `date`：升序
3. 勾选“唯一”

另创建 `_openid`（升序）+ `date`（升序）普通组合索引供范围查询；如果控制台不允许唯一索引同时承担查询，可保留两条。`users` 可为 `_openid` 创建唯一索引，确保每个微信用户仅一条资料。

## 4. 部署与验收

1. 确认 `project.config.json` 的 AppID 对应已开通该云环境的小程序。
2. 在开发者工具选择该云环境，编译并用真机登录。
3. 首次登录会把本地记录按日期迁移；本地记录不会因上传而删除。
4. 在断网状态修改仅部位、仅难度、两者都有以及取消删除四种状态，恢复网络后进入“今天”或“视图”，确认 `workouts` 最终一致。
5. 同一日期两端均有数据时，确认 `updatedAt` 较新的记录胜出。
6. 检查 `users` 中头像、昵称以及 `workouts` 中记录均带当前用户 `_openid`。

头像会上传到 CloudBase 存储，`users.avatarUrl` 保存返回的 `fileID`。还需在“云开发 → 存储 → 权限设置”中配置仅创建者可读写；不要开放匿名读写。
