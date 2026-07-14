#!/usr/bin/env python3
"""一键构建并部署到 GitHub Pages"""
import os, sys, json, base64, subprocess, urllib.request, urllib.error

TOKEN = os.environ.get("GH_TOKEN") or sys.argv[1]
REPO = "bigzeng99/zhiji"
BRANCH = "gh-pages"
API = f"https://api.github.com/repos/{REPO}"
DIST = "dist"

def api_call(path, method="GET", data=None):
    url = f"{API}{path}" if path.startswith("/") else path
    headers = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github.v3+json"}
    if data:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    else:
        body = None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

# Step 1: Build
print("🔨 构建中...")
r = subprocess.run(["npm", "run", "build"], capture_output=True, text=True)
if r.returncode != 0:
    print("构建失败:")
    print(r.stderr)
    sys.exit(1)
print("✓ 构建完成")

# Step 2: Upload dist files
files = []
for root, dirs, filenames in os.walk(DIST):
    for fn in filenames:
        full = os.path.join(root, fn)
        rel = os.path.relpath(full, DIST)
        files.append((rel, full))

print(f"📤 上传 {len(files)} 个文件...")
tree_items = []
for i, (rel, full) in enumerate(files):
    with open(full, "rb") as f:
        content = f.read()
    blob = api_call("/git/blobs", "POST", {
        "content": base64.b64encode(content).decode(),
        "encoding": "base64"
    })
    tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    if (i + 1) % 10 == 0 or i == len(files) - 1:
        print(f"  {i+1}/{len(files)}")

blob = api_call("/git/blobs", "POST", {"content": "", "encoding": "utf-8"})
tree_items.append({"path": ".nojekyll", "mode": "100644", "type": "blob", "sha": blob["sha"]})

tree = api_call("/git/trees", "POST", {"tree": tree_items})

try:
    ref = api_call(f"/git/ref/heads/{BRANCH}")
    parent = ref["object"]["sha"]
    commit = api_call("/git/commits", "POST", {"message": "deploy", "tree": tree["sha"], "parents": [parent]})
except:
    commit = api_call("/git/commits", "POST", {"message": "deploy", "tree": tree["sha"]})

try:
    api_call(f"/git/refs/heads/{BRANCH}", "PATCH", {"sha": commit["sha"], "force": True})
except:
    api_call("/git/refs", "POST", {"ref": f"refs/heads/{BRANCH}", "sha": commit["sha"]})

# Trigger build
try:
    api_call("/pages/builds", "POST")
except:
    pass

print(f"✅ 部署完成！https://bigzeng99.github.io/zhiji/")
