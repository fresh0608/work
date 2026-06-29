# 运营功能调研小应用

## 启动

```bash
npm start
```

默认地址：

- 运营填写页：http://localhost:5177/
- 数据后台：http://localhost:5177/admin
- 本地后台默认密码：`admin123`

部署时建议设置环境变量 `ADMIN_PASSWORD`，覆盖默认后台密码。

## 数据

本地未配置数据库时，提交数据保存在：

```text
data/responses.json
```

线上部署时配置 `DATABASE_URL` 后会优先写入数据库。后台可以实时查看汇总、导出原始数据，也可以清空当前数据。

## 验证

```bash
npm test
```
