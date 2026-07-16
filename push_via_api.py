#!/usr/bin/env python3
"""把本地当前 git 工作树（git ls-files 跟踪的全部文件）作为一个新 commit，
挂在远程指定分支的当前 HEAD 之后，通过 GitHub REST API 直接完成（不走 git 协议，
因为这个沙箱只能连 api.github.com，连不上 github.com 本身）。
"""
import os, sys, json, base64, subprocess, urllib.request

TOKEN = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("GH_TOKEN")
REPO = "bigzeng99/zhiji"
BRANCH = "pwa"
API = f"https://api.github.com/repos/{REPO}"
COMMIT_MESSAGE = sys.argv[2] if len(sys.argv) > 2 else "同步本地历史累积改动"


def api_call(path, method="GET", data=None):
    url = f"{API}{path}" if path.startswith("/") else path
    headers = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github.v3+json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def main():
    files = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout.splitlines()
    print(f"共 {len(files)} 个文件")

    ref = api_call(f"/git/ref/heads/{BRANCH}")
    parent_sha = ref["object"]["sha"]
    print(f"远程 {BRANCH} 当前 HEAD: {parent_sha}")

    tree_items = []
    for i, rel in enumerate(files):
        with open(rel, "rb") as f:
            content = f.read()
        try:
            text = content.decode("utf-8")
            blob = api_call("/git/blobs", "POST", {"content": text, "encoding": "utf-8"})
        except UnicodeDecodeError:
            blob = api_call("/git/blobs", "POST", {"content": base64.b64encode(content).decode(), "encoding": "base64"})
        tree_items.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        if (i + 1) % 20 == 0 or i == len(files) - 1:
            print(f"  已上传 {i + 1}/{len(files)}")

    print("创建 tree...")
    tree = api_call("/git/trees", "POST", {"tree": tree_items})

    print("创建 commit...")
    commit = api_call("/git/commits", "POST", {
        "message": COMMIT_MESSAGE,
        "tree": tree["sha"],
        "parents": [parent_sha]
    })
    print(f"新 commit: {commit['sha']}")

    print(f"更新 {BRANCH} ref...")
    api_call(f"/git/refs/heads/{BRANCH}", "PATCH", {"sha": commit["sha"], "force": False})

    print(f"✅ 完成！https://github.com/{REPO}/commits/{BRANCH}")


if __name__ == "__main__":
    main()
