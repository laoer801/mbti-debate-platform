#!/usr/bin/env python3
"""PK 链路干净测试"""
import json, urllib.request, urllib.error
API = "http://localhost:3001"
def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(API+path, data=data, method=method,
                               headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=10) as f:
            return f.status, f.headers.get("content-type",""), f.read().decode()[:500]
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type",""), e.read().decode()[:500]

print("═"*60)
print("  PK 链路干净测试")
print("═"*60)

tests = [
    ("GET", "/api/pk/rooms/list", None, "房间列表"),
    ("GET", "/api/pk/rooms/me", None, "我的房间"),
    ("GET", "/api/pk/ai/active", None, "AI 活跃房间（如果有）"),
    ("POST", "/api/pk/ai/create", {"userId":"u_diag","level":"beginner","topic":"PK 链路测试"}, "创建 AI 房"),
    ("POST", "/api/pk/ai/create", {"userId":"u_diag","level":"master","topic":"测试 master"}, "创建 master 房"),
]

for m, p, b, name in tests:
    code, ct, body = req(m, p, b)
    is_json = "json" in ct
    icon = "✅" if (code in (200,201) and is_json) else "❌"
    print(f"\n{icon} {name}  [{m} {p}]")
    print(f"   HTTP={code}  Content-Type={ct}")
    print(f"   {body[:200]}")

print("\n" + "═"*60)
print("  完成")
print("═"*60)