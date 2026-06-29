# 部署说明

推荐使用 Render 免费 Web Service 部署这个问卷应用。

## Render 部署

1. 把 `operator-survey-app` 目录推到 GitHub 仓库。
2. 打开 Render，选择 New Web Service 或 Blueprint。
3. Root Directory 填 `operator-survey-app`。
4. Build Command 填 `npm install`。
5. Start Command 填 `npm start`。
6. Plan 选择 Free。
7. Environment 里设置 `ADMIN_PASSWORD`，作为后台登录密码。
8. Blueprint 会同时创建 `operator-survey-db`，并把 `DATABASE_URL` 注入到 Web Service。线上提交会优先写入数据库，避免重启或重新部署后丢失。

应用启动后：

- 问卷地址：`https://你的域名/`
- 后台地址：`https://你的域名/admin`
- 后台密码：使用你在 Render 环境变量里设置的 `ADMIN_PASSWORD`

## 数据说明

线上版本使用 Render Postgres 保存提交数据；本地未配置 `DATABASE_URL` 时，才会使用 `data/responses.json` 作为开发兜底。后台会记录：

- 每次提交的填写快照
- IP、浏览器、设备类型
- 角色、评价功能、提交时间

后台提供“导出原始数据”按钮，正式收集期间建议每天导出一次备份。
