#!/usr/bin/env python3
"""复现 401 + 连续调用看是否限流"""
import json, time, urllib.request
API = "http://localhost:3001"

def chat(model, content):
    r = urllib.request.Request(API+"/api/zhihu/chat", data=json.dumps({"model":model,"messages":[{"role":"user","content":content}]}).encode(), headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30) as f:
            return f.status, json.loads(f.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

print("[1] fast ping", flush=True)
s, d = chat("fast", "ping")
print(f"  HTTP={s} content={d.get('content','')[:80] if isinstance(d, dict) else d}", flush=True)

print("\n[2] fast 5连发", flush=True)
for i in range(5):
    s, d = chat("fast", f"第{i+1}次测试")
    snippet = d.get("content","")[:50] if isinstance(d, dict) else str(d)[:80]
    print(f"  {i+1}. HTTP={s} {snippet}", flush=True)

print("\n[3] thinking 一次（PK 大师档）", flush=True)
s, d = chat("thinking", "ping")
print(f"  HTTP={s} content={d.get('content','')[:80] if isinstance(d, dict) else d}", flush=True)