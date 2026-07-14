#!/usr/bin/env python3
"""上传 seed.json 到 Supabase"""
import json, uuid, urllib.request, urllib.error

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcXBwb2Zic3B0bGp4ZGh4Y3BlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA3OTQ2OCwiZXhwIjoyMDk3NjU1NDY4fQ.0AHtkQem53KuHiS8qGPP1W-Ou7OUr5alWZPAIH5jZpQ"
BASE = "https://joqppofbsptljxdhxcpe.supabase.co/rest/v1"
NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")

def api(path, data, method="POST"):
    url = f"{BASE}{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"  Error {e.code}: {e.read().decode()[:200]}")
        return e.code

seed = json.load(open("src/data/seed.json"))

# 1. Upload subjects with deterministic UUIDs
print(f"📚 上传 {len(seed['subjects'])} 个学科...")
subject_map = {}
for s in seed["subjects"]:
    uid = str(uuid.uuid5(NS, f"zhiji-subject-{s['id']}"))
    subject_map[s["id"]] = uid
    row = {
        "id": uid,
        "name": s["name"],
        "icon": s["icon"],
        "color": s["color"],
        "sort_order": s["sort_order"],
        "is_system": True,
        "owner_id": None,
        "team_id": None
    }
    code = api("/subjects", row)
    if code in (200, 201):
        print(f"  ✓ {s['name']}")
    else:
        print(f"  ⚠ {s['name']} (code={code})")

# 2. Upload points in batches
print(f"\n📝 上传 {len(seed['points'])} 个知识点...")
batch = []
for p in seed["points"]:
    uid = str(uuid.uuid5(NS, f"zhiji-point-{p['id']}"))
    subj_uid = subject_map.get(p["subject_id"])
    if not subj_uid:
        print(f"  ⚠ 跳过 {p['id']}: 未知学科 {p['subject_id']}")
        continue
    batch.append({
        "id": uid,
        "subject_id": subj_uid,
        "owner_id": None,
        "visibility": "public",
        "title": p["title"],
        "category": p.get("category", ""),
        "question": p["question"],
        "answer": p["answer"],
        "status": "active"
    })

# Upload in batches of 50
for i in range(0, len(batch), 50):
    chunk = batch[i:i+50]
    code = api("/points", chunk)
    print(f"  {i+len(chunk)}/{len(batch)} (code={code})")

print(f"\n✅ 完成！共上传 {len(seed['subjects'])} 学科 + {len(batch)} 知识点")

# 3. Sync answers from source points to clones
print(f"\n🔄 同步克隆知识点...")
import urllib.parse

def api_get(path):
    rows, offset = [], 0
    while True:
        url = f"{BASE}{path}&limit=1000&offset={offset}"
        headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
        req = urllib.request.Request(url, headers=headers)
        try:
            data = json.loads(urllib.request.urlopen(req).read())
        except:
            break
        if not data: break
        rows.extend(data)
        if len(data) < 1000: break
        offset += 1000
    return rows

def api_patch(path, data):
    url = f"{BASE}{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        return urllib.request.urlopen(req).status
    except urllib.error.HTTPError as e:
        return e.code

clones = api_get("/points?select=id,source_id,answer&source_id=not.is.null")
source_ids = list(set(c["source_id"] for c in clones if c["source_id"]))
sources = {}
for i in range(0, len(source_ids), 50):
    ids = ",".join(source_ids[i:i+50])
    for r in api_get(f"/points?select=id,answer&id=in.({ids})"):
        sources[r["id"]] = r["answer"]

updated = 0
for c in clones:
    src = sources.get(c["source_id"], "")
    if src and src != (c["answer"] or ""):
        code = api_patch(f'/points?id=eq.{c["id"]}', {"answer": src})
        if code in (200, 204):
            updated += 1

print(f"  同步了 {updated}/{len(clones)} 个克隆知识点")
