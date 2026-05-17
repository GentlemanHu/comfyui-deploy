# ComfyUI Deploy Go Self-Host Edition

> A lightweight, high-performance Go backend and static UI rebuild of ComfyUI Deploy for self-hosted ComfyUI workflow deployment.
>
> ComfyUI Deploy 的 Go 后端 + 静态 UI 自托管版本，用更轻的运行时部署、管理和调用 ComfyUI 工作流。

## Status

This branch is a Go/static-UI optimized branch. It is designed for self-hosting and local/private deployments where the original full Node/Next.js stack is too heavy.

这个分支是 Go + 静态 UI 优化分支，面向自托管、本地部署和私有 ComfyUI 部署场景。目标是减少 Node/Next.js 全栈运行时带来的资源占用，同时保留 ComfyUI Deploy 的核心工作流部署能力。

Important notes:

- This branch is not the official hosted ComfyDeploy SaaS.
- This branch is currently intended for self-host use.
- Authentication is local-admin based. It does not currently implement full SaaS-style multi-user signup, Clerk login, team invitation, billing, or organization management UI.
- Some pages and interactions are close to the original Next.js dashboard, but they may not be 100% 1:1 in every visual detail, animation, copy, and edge-case behavior.
- The database schema still contains user/org fields for compatibility, but the Go self-host runtime creates and uses a configured local user.

重要说明：

- 这个分支不是官方托管版 ComfyDeploy SaaS。
- 当前定位是自托管使用。
- 认证是本地管理员模式，不是完整 SaaS 多账户系统；当前没有完整注册、Clerk 登录、团队邀请、计费、组织管理 UI。
- 页面和交互尽量贴近原 Next.js 控制台，但不保证每个视觉细节、动画、文案和边界交互都已经 100% 1:1。
- 数据库仍保留 user/org 字段以兼容原 schema，但 Go 自托管运行时主要使用配置出来的本地用户。

## Why This Branch

The original ComfyUI Deploy web app is a full Node/Next.js application. That is powerful, but it can be heavy for a small self-hosted deployment. This branch replaces the runtime dashboard/API with:

- Go HTTP backend
- Embedded/static React UI built by Vite
- PostgreSQL storage
- S3-compatible object storage, such as MinIO or Cloudflare R2
- JWT API keys
- Local admin authentication
- Public share pages with optional per-share access keys

原版 ComfyUI Deploy 使用完整 Node/Next.js 运行时。它功能强，但对简单自托管来说会比较重。这个分支改成：

- Go HTTP 后端
- Vite 构建后的静态 React 控制台
- PostgreSQL 数据库
- S3 兼容对象存储，例如 MinIO 或 Cloudflare R2
- JWT API Key
- 本地管理员认证
- 可选单独访问密钥的公开分享页

Expected benefits:

- Lower memory footprint than a full Node/Next.js runtime.
- Faster cold start and simpler deployment shape.
- One Go service serves API and static UI.
- No Clerk dependency for local use.
- No Node runtime required after the static UI is built into the image.

预期收益：

- 比完整 Node/Next.js runtime 更省内存。
- 冷启动和部署结构更简单。
- 一个 Go 服务同时提供 API 和静态 UI。
- 本地部署不依赖 Clerk。
- 静态 UI 构建进镜像后，运行时不需要 Node。

## What Works

Core self-host features in the Go branch:

- Workflow upload/versioning from the ComfyUI plugin.
- Workflow list and workflow detail pages.
- Manual workflow runs from the dashboard.
- External workflow inputs including text, number, boolean, enum, image, video, audio, file, EXR, and face model style file inputs.
- Inline asset input upload: URL, data URL, or base64 can be passed to `/api/run`; the Go backend uploads the asset to S3/MinIO and injects the object URL into the workflow.
- Machine management for Classic ComfyUI endpoints.
- API key creation, display, lookup, and revoke.
- Production, staging, and public-share deployments.
- Public share page run form and result preview.
- Per-share access key, separate from global Basic Auth.
- Run status, progress, staged outputs, and media preview for images, video, audio, PDF, and other files.
- Basic statistics pages for runs, workflow, machine, origin, version, status, date, and deployment performance.
- OpenAPI-style machine-readable docs at `/api/doc`.

Go 分支当前覆盖的核心能力：

- 从 ComfyUI 插件上传 workflow 和创建版本。
- Workflow 列表和详情页。
- 控制台手动运行 workflow。
- 支持文本、数字、布尔、枚举、图片、视频、音频、文件、EXR、FaceModel 等外部输入。
- `/api/run` 支持 URL、data URL、base64 文件输入；Go 后端会自动上传到 S3/MinIO，并把对象 URL 注入 workflow。
- Classic ComfyUI machine 管理。
- API Key 创建、展示、查看、撤销。
- Production、Staging、Public Share 部署。
- Public Share 公开运行表单和结果预览。
- 每个 share 可以配置独立访问密钥，不依赖全站 Basic Auth。
- 运行状态、进度、分阶段输出和媒体预览。
- 支持图片、视频、音频、PDF 和普通文件预览/打开。
- 基础统计页：按 run、workflow、machine、来源、版本、状态、日期、deployment 统计。
- `/api/doc` 提供机器可读的 OpenAPI-style 文档。

## Known Gaps

This branch intentionally focuses on self-hosted core workflows first.

Known limitations:

- Not a complete SaaS multi-user product.
- No Clerk-based sign-in flow in the Go runtime.
- No full billing/team/member invitation system.
- Some original Next.js UI details may still differ.
- Some original serverless provider features may require additional verification.
- The Classic Machine path is the primary target for local/private ComfyUI machines.
- Public object URLs depend on your S3/MinIO/R2 bucket and CDN configuration.

当前分支优先服务自托管核心流程。

已知限制：

- 不是完整 SaaS 多用户产品。
- Go 运行时没有 Clerk 登录流。
- 没有完整账单、团队、成员邀请系统。
- 部分原版 Next.js UI 细节仍可能存在差异。
- 部分原版 serverless provider 能力需要继续验证。
- Classic Machine 是当前本地/私有 ComfyUI 的主要目标路径。
- 输出文件能否长期公开访问取决于你的 S3/MinIO/R2 bucket 和 CDN 配置。

## Architecture

```text
Browser
  |
  | Static React UI + API requests
  v
Go API service
  |-- PostgreSQL: workflows, versions, runs, machines, deployments, API keys
  |-- S3/MinIO/R2: workflow input assets and run outputs
  |-- Classic ComfyUI machine: /comfyui-deploy/run
  |
ComfyUI plugin
  |-- Upload workflow versions
  |-- Receive run payloads
  |-- Upload outputs through signed URLs
  |-- Call /api/update-run with status, progress, and outputs
```

```text
浏览器
  |
  | 静态 React UI + API 请求
  v
Go API 服务
  |-- PostgreSQL：workflow、版本、运行记录、机器、部署、API Key
  |-- S3/MinIO/R2：输入文件和运行输出
  |-- Classic ComfyUI 机器：/comfyui-deploy/run
  |
ComfyUI 插件
  |-- 上传 workflow 版本
  |-- 接收运行 payload
  |-- 通过签名 URL 上传输出
  |-- 调用 /api/update-run 回传状态、进度和输出
```

## Quick Start

### 1. Clone

```bash
git clone https://github.com/GentlemanHu/comfyui-deploy.git
cd comfyui-deploy
git checkout go-backend-static-ui
```

### 2. Create `.env`

```bash
cp .env.example .env 2>/dev/null || touch .env
```

Minimum local values:

```env
JWT_SECRET=replace-with-openssl-rand-hex-32
SPACES_SECRET=replace-with-a-strong-minio-password
LOCAL_AUTH_PASSWORD=replace-with-a-strong-dashboard-password

LOCAL_AUTH_USER_ID=local-admin
LOCAL_AUTH_USER_NAME=Local Admin
LOCAL_AUTH_ORG_ID=
LOCAL_AUTH_ORG_NAME=Local
```

Generate secrets:

```bash
openssl rand -hex 32
```

### 3. Start the Go self-host stack

```bash
docker compose -f docker-compose.go.yml --env-file .env up -d
```

Default local URLs:

- Dashboard: `http://localhost:3000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- PostgreSQL: `127.0.0.1:5480`

默认本地地址：

- 控制台：`http://localhost:3000`
- MinIO API：`http://localhost:9000`
- MinIO 控制台：`http://localhost:9001`
- PostgreSQL：`127.0.0.1:5480`

### 4. Sign in

Open `http://localhost:3000`.

If `LOCAL_AUTH_PASSWORD` is set, the browser will ask for Basic Auth:

- Username: `LOCAL_AUTH_USER_ID` or `LOCAL_AUTH_USER_NAME`
- Password: `LOCAL_AUTH_PASSWORD`

After Basic Auth succeeds, the Go backend issues an HttpOnly local session cookie for dashboard API calls.

打开 `http://localhost:3000`。

如果配置了 `LOCAL_AUTH_PASSWORD`，浏览器会弹出 Basic Auth：

- 用户名：`LOCAL_AUTH_USER_ID` 或 `LOCAL_AUTH_USER_NAME`
- 密码：`LOCAL_AUTH_PASSWORD`

认证成功后，Go 后端会签发 HttpOnly 本地 session cookie，后台 API 会优先使用这个 cookie。

## ComfyUI Plugin Setup

Install the plugin in your ComfyUI instance:

```bash
cd /path/to/ComfyUI/custom_nodes
git clone https://github.com/GentlemanHu/comfyui-deploy.git
```

Restart ComfyUI.

In the ComfyUI plugin, use the ComfyUI Deploy endpoint:

```text
http://localhost:3000
```

For remote ComfyUI machines, expose the ComfyUI endpoint to the Go API service. Common options:

- Same private network or Docker network.
- VPN or LAN.
- Reverse proxy with HTTPS.
- FRP, Tailscale, Cloudflare Tunnel, or similar private networking.

在 ComfyUI 插件里填写 ComfyUI Deploy endpoint：

```text
http://localhost:3000
```

如果 ComfyUI 在另一台机器上，需要让 Go API 能访问到该 ComfyUI endpoint。常见方式：

- 同一内网或 Docker 网络。
- VPN 或局域网。
- HTTPS 反向代理。
- FRP、Tailscale、Cloudflare Tunnel 等私有网络方案。

## Machine Setup

In the dashboard:

1. Open `Machines`.
2. Add a Custom Machine.
3. Set the endpoint to your ComfyUI URL, for example `http://host.docker.internal:8188` or `https://comfy.example.com`.
4. If that ComfyUI endpoint uses Basic Auth, put `username:password` in `auth_token`.

在控制台：

1. 打开 `Machines`。
2. 添加 Custom Machine。
3. Endpoint 填 ComfyUI 地址，例如 `http://host.docker.internal:8188` 或 `https://comfy.example.com`。
4. 如果 ComfyUI endpoint 有 Basic Auth，在 `auth_token` 填 `username:password`。

## Running Workflows

Typical flow:

1. Upload a workflow version from the ComfyUI plugin.
2. Open the workflow in the dashboard.
3. Select version and machine.
4. Click `Run`.
5. Watch run status and outputs.
6. Deploy to `production`, `staging`, or `public-share`.

典型流程：

1. 从 ComfyUI 插件上传 workflow 版本。
2. 在控制台打开 workflow。
3. 选择版本和 machine。
4. 点击 `Run`。
5. 查看运行状态和输出。
6. 部署到 `production`、`staging` 或 `public-share`。

## Public Share Pages

Public share deployments expose a share page:

```text
/share/<share_id_or_slug>
```

Share pages can:

- Render public workflow inputs.
- Run the deployed workflow.
- Show progress and outputs.
- Store recent runs on the current browser/device.
- Use a per-share access key.

If a share has an access key:

- Visitors must enter the share key.
- Run, status polling, and outputs require `X-Share-Key`.
- The owner can open and run their own keyed shares while logged in.

公开分享部署会生成：

```text
/share/<share_id_or_slug>
```

Share 页支持：

- 渲染公开 workflow 输入。
- 运行已部署 workflow。
- 显示进度和输出。
- 在当前浏览器/设备保存最近生成记录。
- 配置每个 share 独立的访问密钥。

如果 share 配置了访问密钥：

- 访客需要输入 share key。
- 运行、状态轮询和输出查看需要 `X-Share-Key`。
- owner 登录后台后，可以直接打开和运行自己的带 key share。

## API Usage

Create an API key in the dashboard, then call:

```bash
curl -X POST http://localhost:3000/api/run \
  -H "Authorization: Bearer $COMFY_DEPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_id": "<DEPLOYMENT_ID>",
    "inputs": {}
  }'
```

Poll:

```bash
curl http://localhost:3000/api/run?run_id=<RUN_ID> \
  -H "Authorization: Bearer $COMFY_DEPLOY_API_KEY"
```

Machine-readable docs:

```text
GET /api/doc
```

在控制台创建 API Key 后即可调用：

```bash
curl -X POST http://localhost:3000/api/run \
  -H "Authorization: Bearer $COMFY_DEPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deployment_id": "<DEPLOYMENT_ID>",
    "inputs": {}
  }'
```

轮询：

```bash
curl http://localhost:3000/api/run?run_id=<RUN_ID> \
  -H "Authorization: Bearer $COMFY_DEPLOY_API_KEY"
```

机器可读接口文档：

```text
GET /api/doc
```

## File and Asset Inputs

Workflow external input nodes can accept:

- Public URL
- Data URL
- Raw base64
- Object form with filename and MIME type

Example:

```json
{
  "deployment_id": "<DEPLOYMENT_ID>",
  "inputs": {
    "input_image": {
      "filename": "input.png",
      "mime_type": "image/png",
      "base64": "<BASE64_WITHOUT_DATA_URL_PREFIX>"
    }
  }
}
```

The Go backend uploads inline assets to object storage and replaces the workflow input with the resulting object URL.

Workflow 外部输入节点支持：

- 公开 URL
- Data URL
- 原始 base64
- 带 filename 和 MIME type 的对象

示例：

```json
{
  "deployment_id": "<DEPLOYMENT_ID>",
  "inputs": {
    "input_image": {
      "filename": "input.png",
      "mime_type": "image/png",
      "base64": "<BASE64_WITHOUT_DATA_URL_PREFIX>"
    }
  }
}
```

Go 后端会把 inline asset 上传到对象存储，并把 workflow 输入替换成上传后的对象 URL。

## Environment Variables

Core variables:

| Variable | Required | Description |
|---|---:|---|
| `JWT_SECRET` | Yes | JWT signing secret. Use `openssl rand -hex 32`. |
| `POSTGRES_URL` | Yes | PostgreSQL connection string. Compose provides a default internal value. |
| `LOCAL_AUTH_PASSWORD` | Recommended | Dashboard Basic Auth password. Required for safe public exposure. |
| `LOCAL_AUTH_USER_ID` | No | Local admin user id. Default: `local-admin`. |
| `LOCAL_AUTH_USER_NAME` | No | Local admin display name. Default: `Local Admin`. |
| `LOCAL_AUTH_ORG_ID` | No | Optional org id for local mode. Leave empty for single local user. |
| `SPACES_ENDPOINT` | Yes | Server-side S3 API endpoint. Do not set this to a CDN URL. |
| `SPACES_PUBLIC_ENDPOINT` | Yes | Browser/ComfyUI reachable S3 API endpoint for signed URLs. |
| `SPACES_ENDPOINT_CDN` | Yes | Public file URL/CDN base. |
| `SPACES_BUCKET` | Yes | Object storage bucket. |
| `SPACES_KEY` | Yes | S3 access key. |
| `SPACES_SECRET` | Yes | S3 secret key. |
| `SPACES_REGION` | Yes | S3 region. Use `auto` for Cloudflare R2. |
| `SPACES_CDN_FORCE_PATH_STYLE` | No | Path-style S3 addressing. Default: `true`. |
| `SPACES_CDN_DONT_INCLUDE_BUCKET` | No | Do not include bucket in public URL path. Useful for R2 custom domains. |
| `GO_API_MAX_UPLOAD_BYTES` | No | Max inline asset upload size. Default: `50MB`. |

核心环境变量：

| 变量 | 必填 | 说明 |
|---|---:|---|
| `JWT_SECRET` | 是 | JWT 签名密钥，建议用 `openssl rand -hex 32`。 |
| `POSTGRES_URL` | 是 | PostgreSQL 连接串；compose 默认提供内部连接串。 |
| `LOCAL_AUTH_PASSWORD` | 建议 | 控制台 Basic Auth 密码；公网暴露时必须设置强密码。 |
| `LOCAL_AUTH_USER_ID` | 否 | 本地管理员用户 ID，默认 `local-admin`。 |
| `LOCAL_AUTH_USER_NAME` | 否 | 本地管理员显示名，默认 `Local Admin`。 |
| `LOCAL_AUTH_ORG_ID` | 否 | 本地模式可选组织 ID；单用户建议留空。 |
| `SPACES_ENDPOINT` | 是 | 服务端 S3 API endpoint，不要填 CDN 地址。 |
| `SPACES_PUBLIC_ENDPOINT` | 是 | 浏览器/ComfyUI 可访问的 S3 API endpoint，用于签名 URL。 |
| `SPACES_ENDPOINT_CDN` | 是 | 文件公开访问 URL/CDN base。 |
| `SPACES_BUCKET` | 是 | 对象存储 bucket。 |
| `SPACES_KEY` | 是 | S3 access key。 |
| `SPACES_SECRET` | 是 | S3 secret key。 |
| `SPACES_REGION` | 是 | S3 region；Cloudflare R2 通常填 `auto`。 |
| `SPACES_CDN_FORCE_PATH_STYLE` | 否 | 是否使用 path-style S3 地址，默认 `true`。 |
| `SPACES_CDN_DONT_INCLUDE_BUCKET` | 否 | 公开 URL 是否不包含 bucket，R2 自定义域常用。 |
| `GO_API_MAX_UPLOAD_BYTES` | 否 | inline asset 最大上传大小，默认 `50MB`。 |

## Object Storage Notes

MinIO local defaults:

```env
SPACES_ENDPOINT=http://minio:9000
SPACES_PUBLIC_ENDPOINT=http://localhost:9000
SPACES_ENDPOINT_CDN=http://localhost:9000
SPACES_CDN_FORCE_PATH_STYLE=true
SPACES_CDN_DONT_INCLUDE_BUCKET=false
```

Cloudflare R2 typical values:

```env
SPACES_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
SPACES_PUBLIC_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
SPACES_ENDPOINT_CDN=https://<public-r2-domain-or-custom-domain>
SPACES_REGION=auto
SPACES_CDN_FORCE_PATH_STYLE=true
SPACES_CDN_DONT_INCLUDE_BUCKET=true
```

Notes:

- Signed S3 URLs are host-sensitive.
- Do not put Basic Auth in front of the S3 API domain used for signed uploads.
- `SPACES_ENDPOINT` is used by the Go server for direct PutObject calls.
- `SPACES_PUBLIC_ENDPOINT` is used to generate signed URLs for browsers and ComfyUI.
- `SPACES_ENDPOINT_CDN` is used to build public file URLs.

注意：

- S3 签名 URL 对 Host 敏感。
- 不要给用于签名上传的 S3 API 域名加 Basic Auth。
- `SPACES_ENDPOINT` 是 Go 服务端直传对象时用的 API endpoint。
- `SPACES_PUBLIC_ENDPOINT` 是生成浏览器/ComfyUI 签名 URL 用的 endpoint。
- `SPACES_ENDPOINT_CDN` 是拼接公开文件 URL 用的地址。

## Production Reverse Proxy

Recommended:

- Put the Go API behind HTTPS.
- Set `LOCAL_AUTH_PASSWORD`.
- Restrict MinIO Console with IP allowlist or separate Basic Auth.
- Keep PostgreSQL and MinIO API private where possible.
- Do not expose ComfyUI publicly unless it has its own protection.
- Use a private network, VPN, FRP, Tailscale, or reverse proxy for Classic ComfyUI machines.

建议：

- Go API 放在 HTTPS 反向代理后。
- 设置 `LOCAL_AUTH_PASSWORD`。
- MinIO Console 加 IP 白名单或单独 Basic Auth。
- PostgreSQL 和 MinIO API 尽量只在内网暴露。
- 不要裸露 ComfyUI，除非它自己有保护。
- Classic ComfyUI machine 推荐通过内网、VPN、FRP、Tailscale 或反代连接。

## Development

Go API:

```bash
cd go-api
go test ./...
go build ./...
```

Static UI:

```bash
cd go-api/static-ui
npm install
npm run build
```

Run from source:

```bash
cd go-api
GO_API_ADDR=:3000 \
POSTGRES_URL=postgres://postgres:postgres@localhost:5480/verceldb?sslmode=disable \
JWT_SECRET=<secret> \
SPACES_SECRET=<secret> \
go run ./cmd/comfydeploy-go
```

## Original Node/Next.js App

The original upstream project uses:

- Next.js
- Clerk
- Drizzle
- Vercel/Neon/Postgres
- R2/S3

That stack is still useful for the original SaaS-style architecture. This branch is a self-host-oriented Go/static alternative.

原始上游项目使用：

- Next.js
- Clerk
- Drizzle
- Vercel/Neon/Postgres
- R2/S3

这套技术栈仍适合原版 SaaS 架构。当前分支是面向自托管的 Go/static 替代实现。

## License and Credits

ComfyUI Deploy builds around ComfyUI and the original ComfyDeploy ecosystem.

Special thanks:

- ComfyUI
- Original ComfyDeploy contributors
- Open source custom node ecosystem

ComfyUI Deploy 围绕 ComfyUI 和原 ComfyDeploy 生态构建。

特别感谢：

- ComfyUI
- 原 ComfyDeploy 贡献者
- 开源 ComfyUI custom node 生态
