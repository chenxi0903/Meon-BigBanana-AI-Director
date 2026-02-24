## Jimeng API 使用说明（独立文档）

本项目提供一个基于即梦 / dreamina 逆向工程实现的 **统一 HTTP 服务**，用于图像生成、图生图、视频生成以及 Token / 积分管理。你可以把它当成“中间层后端”，所有前端或其他后端只需要调用本服务，不需要直接对接即梦的私有接口。

---

## 一、运行服务

### 1. 环境要求

- **Node.js**: 18+
- **包管理器**: npm 或 yarn
- **Docker / docker-compose**（可选，但推荐）

### 2. Docker 运行（推荐）

```bash
docker run -d \
  --name jimeng-api \
  -p 5100:5100 \
  --restart unless-stopped \
  ghcr.io/iptag/jimeng-api:latest
```

或使用 `docker-compose`：

```bash
docker-compose up -d             # 启动
docker-compose up -d --build     # 重新构建并启动
docker logs jimeng-api           # 查看日志
docker-compose down              # 停止
```

### 3. 源码本地运行

```bash
cd jimeng-api-main   # 进入项目根目录

npm install          # 安装依赖
npm run build        # 编译

# 开发模式（自动重编译 + 自动运行）
npm run dev

# 或生产模式
npm start
```

服务默认监听 **5100 端口**，根路径 `/` 会返回服务状态与接口介绍。

---

## 二、Token / sessionid 与地区、代理

### 1. 获取 sessionid

在即梦国内站或国际站（dreamina）的网页端登录后，从浏览器中获取 **sessionid**（README.CN.md 中有示意图和说明）。

### 2. 地区前缀

server 通过 Token 前缀区分不同站点，Token 基本格式为：

```text
[地区前缀-]session_id
```

- 国内站：`session_id_xxx`
- 美国站：`us-session_id_xxx`
- 香港站：`hk-session_id_xxx`
- 日本站：`jp-session_id_xxx`
- 新加坡站：`sg-session_id_xxx`

### 3. 绑定代理（可选）

为了解决 IP / 积分相关问题，可以在 Token 外层再包一层代理前缀：

```text
[代理URL@][地区前缀-]session_id
```

示例：

- 国内 + SOCKS5 代理：`socks5://127.0.0.1:1080@session_id_xxx`
- 美国 + HTTP 代理：`http://127.0.0.1:7890@us-session_id_xxx`
- 香港 + 带账号密码代理：`http://user:pass@proxy.com:8080@hk-session_id_xxx`

所有 HTTP 请求都统一通过 `Authorization` 头传入：

```bash
-H "Authorization: Bearer <上面的 token 串>"
```

---

## 三、主要 API 接口与用法

### 1. 文生图 `POST /v1/images/generations`

**典型参数：**

- `model` (string，可选)：如 `jimeng-4.5`，服务会根据地区自动映射到底层真实模型
- `prompt` (string)：提示词
- `ratio` (string，可选)：比例，默认 `"1:1"`，如 `16:9`、`9:16` 等
- `resolution` (string，可选)：`1k` / `2k` / `4k`，默认 `2k`
- `intelligent_ratio` (boolean，可选)：是否根据 prompt 智能推比例（仅部分模型生效）
- `negative_prompt` (string，可选)：负面提示
- `sample_strength` (number，可选)：采样强度 0.0–1.0
- `response_format` (string，可选)：`"url"` 或 `"b64_json"`

**示例：**

```bash
curl -X POST http://localhost:5100/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "model": "jimeng-4.5",
    "prompt": "一只可爱的小猫咪"
  }'
```

返回结构类似 OpenAI：

```json
{
  "created": 1759058768,
  "data": [
    { "url": "https://example.com/image1.jpg" }
  ]
}
```

### 2. 图生图 `POST /v1/images/compositions`

**核心逻辑：**

1. 从 Token 中解析地区与代理。
2. 根据地区/模型名做模型映射。
3. 调用积分接口，若积分为 0 会尝试自动领取每日积分。
4. 逐张上传输入图片（支持 URL 或本地文件），并做内容合规检测。
5. 构建底层请求 payload，提交到即梦 / dreamina 官方接口。
6. 通过智能轮询（SmartPoller）查询任务结果，直到生成完成或超时。
7. 从返回的 `item_list` 中提取真正的图片 URL，并以统一格式返回。

**本地文件示例：**

```bash
curl -X POST http://localhost:5100/v1/images/compositions \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -F "prompt=一只可爱的猫，动漫风格" \
  -F "model=jimeng-4.5" \
  -F "ratio=1:1" \
  -F "resolution=1k" \
  -F "images=@/path/to/your/local/cat.jpg"
```

**URL 示例（application/json）：**

```bash
curl -X POST http://localhost:5100/v1/images/compositions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "model": "jimeng-4.5",
    "prompt": "将这张照片转换为油画风格，色彩鲜艳，笔触明显",
    "images": ["https://example.com/photo.jpg"],
    "ratio": "1:1",
    "resolution": "2k",
    "sample_strength": 0.7
  }'
```

### 3. 视频生成 `POST /v1/videos/generations`

支持模式：

1. **文生视频**：仅传 `prompt`（Text-to-Video）
2. **图生视频**：首帧图片 → 视频
3. **首尾帧视频**：首帧 + 尾帧两张图片
4. **全能模式 (Omni Reference)**：多图多视频混合参考（仅 `jimeng-video-seedance-2.0`）

**常用参数：**

- `model`：视频模型名（如 `jimeng-video-3.0` / `jimeng-video-3.5-pro` 等）
- `prompt`：描述视频内容
- `ratio`：比例 `1:1` / `16:9` / `9:16` 等
- `resolution`：`720p` / `1080p`（仅部分模型支持）
- `duration`：时长（不同模型支持的值不同）
- `file_paths` / `image_file_*` / `video_file_*`：输入素材
- `functionMode`：默认 `first_last_frames`，全能模式为 `omni_reference`

**文生视频示例：**

```bash
curl -X POST http://localhost:5100/v1/videos/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "model": "jimeng-video-3.0",
    "prompt": "一只奔跑在草原上的狮子",
    "ratio": "16:9",
    "resolution": "1080p",
    "duration": 10
  }'
```

---

## 四、Token 与积分相关接口

这些接口主要帮助你检查 Token 状态、查询积分、手动触发领取每日积分。

### 1. 检查 Token 是否有效 `POST /token/check`

请求体：

```json
{ "token": "your_session_id_or_prefixed_token" }
```

响应：

```json
{ "live": true }
```

### 2. 获取积分 `POST /token/points`

请求头：

```bash
-H "Authorization: Bearer TOKEN1,TOKEN2,TOKEN3"
```

响应：

```json
[
  {
    "token": "your_token",
    "points": {
      "giftCredit": 10,
      "purchaseCredit": 0,
      "vipCredit": 0,
      "totalCredit": 10
    }
  }
]
```

### 3. 领取每日积分 / 批量签到 `POST /token/receive`

```bash
# 单个 token
curl -X POST http://localhost:5100/token/receive \
  -H "Authorization: Bearer YOUR_SESSION_ID"

# 多个 token
curl -X POST http://localhost:5100/token/receive \
  -H "Authorization: Bearer TOKEN1,TOKEN2,TOKEN3"
```

服务器会尝试为每个 token 领取当日积分，并返回领取后的积分与是否成功领取的标记。

---

## 五、内部逻辑快速理解（给开发者看的）

- `src/index.ts`：应用入口，加载环境与配置，启动 HTTP 服务器并挂载路由。
- `src/api/routes/*.ts`：路由定义，把类似 `/v1/images/generations` 等路径映射到控制器。
- `src/api/controllers/images.ts` / `videos.ts`：
  - 解析 Token，识别地区 / 代理。
  - 根据地区从模型映射表中选择底层真实模型。
  - 调用积分接口；若积分不足会尝试自动领取。
  - 处理图片 / 视频上传。
  - 调用官方生成接口，并使用 `SmartPoller` 智能轮询任务状态。
  - 从历史记录中提取图片 / 视频 URL，统一返回。
- `src/lib/smart-poller.ts`：封装轮询策略（间隔、最大次数、超时、结果统计等）。
- `src/lib/exceptions/*.ts` + `src/api/consts/exceptions.ts`：统一错误码与异常类型。

如果你要在别的后端项目中集成本服务，只需要把它当作一个 **普通 HTTP 服务** 调用即可（类似调用 OpenAI API）。在上层代码里关心的只有：

1. **服务地址**：如 `http://localhost:5100`
2. **Authorization** 头：`Bearer <你的 token 串>`
3. **对应的路径和参数**：`/v1/images/generations`、`/v1/images/compositions`、`/v1/videos/generations` 等

---

如需根据你自己的技术栈（Node / Python / Java / Go 等）生成具体的“调用示例代码”，可以告诉我语言和框架，我可以在本文件的基础上再帮你写一份示例客户端说明。

