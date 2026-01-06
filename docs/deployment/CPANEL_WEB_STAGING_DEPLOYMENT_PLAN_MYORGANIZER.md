# cPanel Staging Environment - MyOrganizer Next.js Web App Deployment Plan (Node.js)

**Project:** MyOrganizer - Next.js Web Application  
**Environment:** Staging/Testing  
**Hosting:** Namecheap cPanel Shared Hosting  
**Date Created:** January 5, 2026  
**Status:** ✅ Ready for Deployment

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [What's Been Configured](#whats-been-configured)
3. [Prerequisites](#prerequisites)
4. [Quick Start Deployment](#quick-start-deployment)
5. [Deployment Script](#deployment-script)
6. [Manual Deployment Process](#manual-deployment-process)
7. [Environment Configuration](#environment-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Performance Optimization](#performance-optimization)
10. [Automated Deployment with GitHub Actions](#automated-deployment-with-github-actions)
11. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🎯 Overview

This document outlines the deployment strategy for hosting the **MyOrganizer web app (Next.js)** as a **Node.js application** on Namecheap cPanel shared hosting.

### Target Domain

- **Web:** `https://myorganiser.app`

### Key Challenges

1. **Nx Monorepo Structure**: the Next.js app lives inside an Nx workspace.
2. **Shared Hosting Limitations**: constrained CPU/memory; installs can time out.
3. **Next.js Standalone Output**: best practice for cPanel is to deploy a standalone server with minimal dependencies.
4. **API Integration**: the web app must call the API at `https://api.myorganiser.app/api/v1`.

### Deployment Strategy

We use a **build-time environment variable** approach and package a self-contained deployment bundle:

1. Build Next.js with `output: 'standalone'`
2. Package a Linux-safe bundle with a root `server.js`
3. Upload to cPanel → Setup Node.js App → start with `server.js`

---

## ✅ What's Been Configured

### Build Configuration

- ✅ Next.js is configured with `output: 'standalone'` for Node deployment.

### Packaging Script

- ✅ Node packaging script: `tools/scripts/package-myorganizer-web.mjs`
- ✅ Nx target: `myorganizer:package`
- ✅ Root script: `yarn package:myorganizer:web`

### What the Script Does

1. Builds the Next.js app via Nx (standalone output)
2. Generates a deploy-only `package.json` automatically from `.next/standalone/node_modules`
3. Copies the build output `.next/` into `dist/deploy/myorganizer-web/.next/`
4. Copies `public/` assets into `dist/deploy/myorganizer-web/public/`
5. Generates a Linux-safe root `server.js` (avoids Windows path issues)
6. Creates a deployment folder ready for cPanel (without `node_modules`)

---

## ✅ Prerequisites

### Local

- Node.js 18+
- Yarn
- Working Nx build for `myorganizer`

### cPanel

- “Setup Node.js App” available
- Node.js 18.x or 20.x
- SSH access recommended

---

## 🚀 Quick Start Deployment

### Step 1: Set runtime API URL

The web app prefers a runtime env var (`API_BASE_URL`) so you can change the API endpoint **without rebuilding**.

Set it in cPanel (recommended):

```bash
API_BASE_URL=https://api.myorganiser.app/api/v1
```

You can still set `NEXT_PUBLIC_API_BASE_URL` during local builds/dev as a fallback, but it is no longer required for production deployments.

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_API_BASE_URL='https://api.myorganiser.app/api/v1'

yarn package:myorganizer:web
```

```bash
# Bash (Git Bash / WSL)
NEXT_PUBLIC_API_BASE_URL=https://api.myorganiser.app/api/v1 \
  yarn package:myorganizer:web
```

### Step 2: Upload the package

Upload the contents of `dist/deploy/myorganizer-web/` (including the root `server.js`).

…to your cPanel Node.js application root (example):

- `~/myorganizer-web/`

### Step 3: Create Node.js App in cPanel

cPanel → **Setup Node.js App** → **Create Application**

```
Node.js Version: 18.x or 20.x
Application Mode: Production
Application Root: myorganizer-web
Application URL: https://myorganiser.app
Application Startup File: server.js
```

### Step 4: Start

- Click **Run NPM Install** (required).
  - This bundle intentionally does **not** include `node_modules`.
- Click **Start/Restart**.

---

## 🛠️ Deployment Script

### Run the packager

```bash
yarn package:myorganizer:web
```

Output:

- Folder: `dist/deploy/myorganizer-web/`

---

## 📦 Manual Deployment Process

1. **Build + package locally** with `yarn package:myorganizer:web`
2. **Upload** the deployment folder to the cPanel Node app root
3. **Set environment variables** (below)
4. **Restart** the Node app

---

## ⚙️ Environment Configuration

### cPanel environment variables

Recommended:

```bash
NODE_ENV=production
PORT=3000
```

Notes:

- Prefer setting `API_BASE_URL` in cPanel (runtime).
- `NEXT_PUBLIC_API_BASE_URL` remains supported as a fallback for local development/builds.

---

## 🔧 Troubleshooting

### App loads but API calls fail

- Confirm cPanel env vars include:
  - `API_BASE_URL=https://api.myorganiser.app/api/v1`
- Confirm the backend allows the origin:
  - `CORS_ORIGINS=https://myorganiser.app,https://www.myorganiser.app`

### 404s for static assets

- Ensure `.next/static` exists on the server at:
  - `myorganizer-web/.next/static`
- Ensure `public/` exists at:
  - `myorganizer-web/public`

### Node app won’t start

- Check `stderr.log` / `stdout.log`
- Verify startup file is exactly `server.js`

---

## ⚡ Performance Optimization

- Standalone output reduces dependency size and startup time.
- Enable caching/CDN for static assets if available via your hosting provider.

---

## 🤖 Automated Deployment with GitHub Actions

Once manual deploy is stable, automate:

- build + package
- upload via SSH/SCP
- restart via `tmp/restart.txt`

(We can add a workflow tailored to your cPanel paths.)

---

## 📊 Monitoring & Maintenance

- cPanel Metrics → Resource Usage
- Uptime monitor `https://myorganiser.app`
