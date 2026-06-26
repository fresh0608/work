# 部署说明

推荐使用 Render 免费 Web Service 部署这个问卷应用。

## Render 部署

1. 把 `operator-survey-app` 目录推到 GitHub 仓库。
2. 打开 Render，选择 New Web Service 或 Blueprint。
3. Root Directory 填 `operator-survey-app`。
4. Build Command 填 `npm install`。
5. Start Command 填 `npm start`。
6. Plan 选择 Free。

应用启动后：

- 问卷地址：`https://你的域名/`
- 后台地址：`https://你的域名/admin`

## 数据说明

当前版本使用 `data/responses.json` 保存提交数据，后台会记录：

- 每次提交的填写快照
- IP、浏览器、设备类型
- 角色、评价功能、提交时间

Render 免费实例的本地文件适合短期收集问卷。若后续要长期正式使用，建议把存储切到 Supabase 或 Render Postgres。
