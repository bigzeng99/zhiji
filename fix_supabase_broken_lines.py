#!/usr/bin/env python3
"""批量清洗 Supabase points 表里 question/answer 字段的排版问题。

清洗规则统一在 src/utils/contentNormalize.js 的 normalizeKnowledgeContent()
里实现（合并被错误拆断的换行、合并假分裂的编号列表续句、去除历史遗留的
[[term]] 方括号高亮标记、收敛连续空行）。本脚本通过 subprocess 调用
scripts/normalize_stdin.mjs 这个 Node CLI 桥接来复用同一份清洗逻辑，
不在 Python 端重新实现一套规则，避免两边行为不一致。

前置条件：
- 需要能访问 supabase.co（此环境目前 DNS 无法解析该域名，需在有网络权限
  的机器上运行）
- 需要能执行 node（调用 scripts/normalize_stdin.mjs）

用法: python3 fix_supabase_broken_lines.py [--dry-run]
"""
import json, urllib.request, urllib.error, sys, subprocess, os

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ"
BASE = "https://joqppofbsptljxdhcpe.supabase.co/rest/v1"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NORMALIZE_CLI = os.path.join(SCRIPT_DIR, "scripts", "normalize_stdin.mjs")


def fetch_all_points():
    rows = []
    offset = 0
    while True:
        url = f"{BASE}/points?select=id,title,question,answer&limit=1000&offset={offset}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req) as r:
            data = json.loads(r.read())
            if not data:
                break
            rows.extend(data)
            if len(data) < 1000:
                break
            offset += 1000
    return rows


def normalize_batch(strings):
    """调用 Node CLI，用与 App 完全相同的 normalizeKnowledgeContent 清洗一批字符串。"""
    proc = subprocess.run(
        ["node", NORMALIZE_CLI],
        input=json.dumps(strings, ensure_ascii=False),
        capture_output=True, text=True, encoding="utf-8"
    )
    if proc.returncode != 0:
        raise RuntimeError(f"normalize_stdin.mjs 执行失败: {proc.stderr}")
    return json.loads(proc.stdout)


def update_point(pid, new_question, new_answer):
    url = f"{BASE}/points?id=eq.{pid}"
    body = json.dumps({"question": new_question, "answer": new_answer}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={**HEADERS, "Prefer": "return=minimal"}, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return r.status


def main():
    dry = "--dry-run" in sys.argv
    print("Fetching all points...")
    points = fetch_all_points()
    print(f"Total: {len(points)}")

    # 批量清洗：把所有 question+answer 一次性丢给 Node CLI，减少子进程调用次数
    questions = [p.get("question") or "" for p in points]
    answers = [p.get("answer") or "" for p in points]

    print("Normalizing questions...")
    new_questions = normalize_batch(questions)
    print("Normalizing answers...")
    new_answers = normalize_batch(answers)

    to_fix = []
    for p, nq, na in zip(points, new_questions, new_answers):
        q_changed = nq != (p.get("question") or "")
        a_changed = na != (p.get("answer") or "")
        if q_changed or a_changed:
            to_fix.append((p["id"], p.get("title", "")[:30], p.get("question", ""), nq, p.get("answer", ""), na))

    print(f"Will fix: {len(to_fix)}")
    for pid, title, oq, nq, oa, na in to_fix[:10]:
        print(f"  [{title}]")
        if oq != nq:
            print(f"    Q BEFORE: {oq[:100]!r}")
            print(f"    Q AFTER:  {nq[:100]!r}")
        if oa != na:
            print(f"    A BEFORE: {oa[:100]!r}")
            print(f"    A AFTER:  {na[:100]!r}")

    if dry:
        print("Dry run, not updating.")
        return

    if input(f"Update {len(to_fix)} points? (y/N) ").strip().lower() != "y":
        return

    ok = 0
    for pid, title, oq, nq, oa, na in to_fix:
        try:
            update_point(pid, nq, na)
            ok += 1
        except Exception as e:
            print(f"  FAIL {title}: {e}")
    print(f"Updated {ok}/{len(to_fix)}")


if __name__ == "__main__":
    main()
