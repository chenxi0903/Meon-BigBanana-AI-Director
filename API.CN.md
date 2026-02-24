## Jimeng API 接口调用速查

> 只关注「怎么调用」与「有哪些接口可以用」，配合 `USAGE.CN.md` / `DEPLOYMENT.CN.md` 一起看效果更好。

统一规则：

- 基础地址示例：
  - IP 形式：`http://<服务器IP>:5100`
  - 域名形式：`https://<你的域名>`
- 所有需要鉴权的接口，都使用：

```http
Authorization: Bearer <你的 token 串>
```

Token 规则（含地区前缀、代理前缀）详见 `USAGE.CN.md` / `DEPLOYMENT.CN.md`。

---

## 一、服务与健康检查

### 1. 获取服务信息

- **方法**：`GET /`
- **是否需要鉴权**：否
- **用途**：检查服务是否启动、查看版本信息和主要入口。

**示例：**

```bash
curl http://localhost:5100/
```

---

### 2. 健康检查

- **方法**：`GET /ping`
- **是否需要鉴权**：否
- **用途**：用于探活（K8s、监控、外部健康检查）。

**示例：**

```bash
curl http://localhost:5100/ping
```

---

## 二、图像相关接口

### 1. 文生图（Text to Image）

- **方法**：`POST /v1/images/generations`
- **是否需要鉴权**：是
- **说明**：输入文本提示词，生成图片。

**支持参数（JSON body）：**

- `model` (string, 可选)：模型名，如：
  - `nanobananapro`（仅国际）
  - `nanobanana`（仅国际）
  - `jimeng-5.0`（国内 + 亚洲国际）
  - `jimeng-4.6`（国内 + 亚洲国际）
  - `jimeng-4.5`（国内 + 国际，默认）
  - `jimeng-4.1`、`jimeng-4.0`、`jimeng-3.1`、`jimeng-3.0`
- `prompt` (string, 必填)：提示词
- `ratio` (string, 可选，默认 `"1:1"`）：
  - `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3`, `21:9`
- `resolution` (string, 可选，默认 `"2k"`）：
  - `1k`, `2k`, `4k`
- `intelligent_ratio` (boolean, 可选，默认 `false`):
  - 仅对 `jimeng-4.0/4.1/4.5/4.6/5.0` 有效
  - 开启后根据提示词自动推比例（如“竖屏”→ `9:16`）
- `negative_prompt` (string, 可选)：反向提示词
- `sample_strength` (number, 可选)：采样强度（0.0–1.0）
- `response_format` (string, 可选)：`"url"` 或 `"b64_json"`

**调用示例：**

```bash
curl -X POST http://localhost:5100/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "model": "jimeng-4.5",
    "prompt": "一只可爱的小猫咪",
    "ratio": "1:1",
    "resolution": "2k"
  }'
```

**返回示例（url 模式）：**

```json
{
  "created": 1759058768,
  "data": [
    { "url": "https://example.com/image1.jpg" }
  ]
}
```

---

### 2. 图生图 / 图像合成（Image to Image）

- **方法**：`POST /v1/images/compositions`
- **是否需要鉴权**：是
- **说明**：基于输入图片 + 文本提示词生成新图，支持 URL 或本地文件、多图融合等。

**支持两种提交方式：**

#### 2.1 JSON + 远程图片 URL

- `Content-Type: application/json`

**JSON body 参数：**

- `model` (string, 可选)：同文生图
- `prompt` (string, 必填)：提示词
- `images` (string[]，必填)：图片 URL 列表
- `ratio` (string, 可选)：同文生图
- `resolution` (string, 可选)：同文生图
- `intelligent_ratio` (boolean, 可选)：同文生图
- `negative_prompt` (string, 可选)
- `sample_strength` (number, 可选)
- `response_format` (string, 可选)：`"url"` 或 `"b64_json"`

**示例：**

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

#### 2.2 multipart/form-data + 本地文件

- `Content-Type: multipart/form-data`

常用字段：

- `prompt`：提示词
- `model`：模型名
- `ratio`、`resolution`、`sample_strength` 等同上
- `images`：一个或多个文件字段（可重复）

**单文件示例：**

```bash
curl -X POST http://localhost:5100/v1/images/compositions \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -F "prompt=一只可爱的猫，动漫风格" \
  -F "model=jimeng-4.5" \
  -F "ratio=1:1" \
  -F "resolution=1k" \
  -F "images=@/path/to/your/local/cat.jpg"
```

---

## 三、视频相关接口

### 1. 视频生成（Text / Image / Multi-Ref to Video）

- **方法**：`POST /v1/videos/generations`
- **是否需要鉴权**：是
- **说明**：支持纯文本、首帧图生视频、首尾帧、以及全能模式（多图多视频参考）。

**关键参数（JSON 或 multipart/form-data）：**

- `model` (string, 必填)：视频模型：
  - `jimeng-video-seedance-2.0` / `jimeng-video-seedance-2.0-fast`
  - `jimeng-video-3.5-pro`（默认）
  - `jimeng-video-veo3` / `jimeng-video-veo3.1`
  - `jimeng-video-sora2`
  - `jimeng-video-3.0-pro` / `jimeng-video-3.0` / `jimeng-video-3.0-fast`
  - `jimeng-video-2.0-pro` / `jimeng-video-2.0`
- `prompt` (string, 必填)：视频描述
- `ratio` (string, 可选)：`1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`
- `resolution` (string, 可选)：`720p`, `1080p`（仅部分模型支持）
- `duration` (number, 可选)：时长，依模型不同：
  - `jimeng-video-veo3/veo3.1`：8 （固定）
  - `jimeng-video-sora2`：4（默认）/ 8 / 12
  - `jimeng-video-seedance-2.0`：4–15 任意整数，默认 5
  - `jimeng-video-3.5-pro`：5（默认）/ 10 / 12
  - 其他：5（默认）/ 10
- `response_format` (string, 可选)：`url` 或 `b64_json`

#### 1.1 纯文生视频（不带图）

**示例：**

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

#### 1.2 图生视频（首帧图片）

**multipart/form-data 示例：**

```bash
curl -X POST http://localhost:5100/v1/videos/generations \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -F "prompt=一个男人在说话" \
  -F "model=jimeng-video-3.0" \
  -F "ratio=9:16" \
  -F "duration=5" \
  -F "image_file_1=@/path/to/your/first-frame.png"
```

#### 1.3 首尾帧视频（two-frame）

```bash
curl -X POST http://localhost:5100/v1/videos/generations \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -F "prompt=场景之间的平滑过渡" \
  -F "model=jimeng-video-3.0" \
  -F "ratio=16:9" \
  -F "duration=10" \
  -F "image_file_1=@/path/to/first-frame.png" \
  -F "image_file_2=@/path/to/last-frame.png"
```

#### 1.4 全能模式（Omni Reference，Seedance 2.0）

- `functionMode=omni_reference`
- 图片字段：`image_file_1` ~ `image_file_9`
- 视频字段：`video_file_1` ~ `video_file_3`
- 可以本地文件或 URL 混合
- 在 `prompt` 里用 `@字段名` 引用（注意 curl 里用 `--form-string`）

**示例：**

```bash
curl -X POST http://localhost:5100/v1/videos/generations \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  --form-string "prompt=@image_file_1作为首帧，@image_file_2作为尾帧，运动动作模仿@video_file_1" \
  -F "model=jimeng-video-seedance-2.0" \
  -F "functionMode=omni_reference" \
  -F "ratio=16:9" \
  -F "duration=5" \
  -F "image_file_1=@/path/to/first.png" \
  -F "image_file_2=@/path/to/second.png" \
  -F "video_file_1=@/path/to/reference-video.mp4"
```

---

## 四、模型与 Token 相关接口

### 1. 模型列表

- **方法**：`GET /v1/models`
- **是否需要鉴权**：通常需要（视实现而定）
- **用途**：获取当前可用的模型列表（图像/视频）。

**示例：**

```bash
curl -X GET http://localhost:5100/v1/models \
  -H "Authorization: Bearer YOUR_SESSION_ID"
```

---

### 2. Token 状态检查

- **方法**：`POST /token/check`
- **是否需要鉴权**：否（在 body 中传 token）
- **说明**：检查某个 Token 是否存活。

**请求体：**

```json
{ "token": "your_token_or_session_id" }
```

**示例：**

```bash
curl -X POST http://localhost:5100/token/check \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_SESSION_ID"}'
```

**响应示例：**

```json
{ "live": true }
``>

---

### 3. 获取 Token 积分

- **方法**：`POST /token/points`
- **是否需要鉴权**：是（使用 Authorization 头）
- **说明**：批量查询一个或多个 Token 的积分余额。

**请求头：**

```http
Authorization: Bearer TOKEN1,TOKEN2,TOKEN3
```

**示例：**

```bash
curl -X POST http://localhost:5100/token/points \
  -H "Authorization: Bearer TOKEN1,TOKEN2,TOKEN3"
```

**响应示例：**

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

---

### 4. 领取每日积分 / 签到

- **方法**：`POST /token/receive`
- **是否需要鉴权**：是
- **说明**：手动触发某些 Token 的每日积分领取逻辑。

**请求头：**

```http
Authorization: Bearer TOKEN1,TOKEN2,TOKEN3
```

**示例：**

```bash
# 单个 token
curl -X POST http://localhost:5100/token/receive \
  -H "Authorization: Bearer YOUR_SESSION_ID"

# 多个 token 批量签到
curl -X POST http://localhost:5100/token/receive \
  -H "Authorization: Bearer TOKEN1,TOKEN2,TOKEN3"
```

**响应示例：**

```json
[
  {
    "token": "your_token",
    "credits": {
      "giftCredit": 10,
      "purchaseCredit": 0,
      "vipCredit": 0,
      "totalCredit": 10
    },
    "received": true,
    "error": null
  }
]
```

---

## 五、如何在自己的项目中使用

统一调用套路：

1. 确定服务地址（IP 或域名，是否 HTTPS）。  
2. 在登录即梦 / dreamina 后拿到 `sessionid`，按地区和代理规则拼好 Token。  
3. 在代码中设置请求头：

```http
Authorization: Bearer <你的 token 串>
Content-Type: application/json    # 或 multipart/form-data
```

4. 按本文件中给出的对应路径与参数发起 HTTP 请求。  

如果你告诉我：  
- 使用的语言（Node / Python / Java / Go / PHP / …）  
- 以及使用的 HTTP 库（axios / fetch / requests / OkHttp / …）  

我可以帮你再写一份「对应语言的客户端调用示例」，直接复制到你的项目里使用。 
