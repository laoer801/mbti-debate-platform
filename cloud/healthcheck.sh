#!/bin/bash
echo '═══ 1️⃣ 进程与端口 ═══'
ps -ef | grep -E 'node.*server\.js|mbti' | grep -v grep | head
echo '──端口──'
ss -tlnp 2>/dev/null | grep -E ':3001|:3443'

echo
echo '═══ 2️⃣ .env 完整性 ═══'
ls -la /opt/mbti/.env
echo '──原始字节数/行数──'
wc -c -l /opt/mbti/.env
echo '──逐行(键脱敏)──'
nl /opt/mbti/.env | sed -E 's/(SECRET|TOKEN|KEY|JWT|ZHIHU_ACCESS_SECRET)=.+/\1=<REDACTED>/'

echo
echo '═══ 3️⃣ /api/zhihu/status ═══'
curl -sS --max-time 6 http://localhost:3001/api/zhihu/status; echo

echo
echo '═══ 4️⃣ LLM 三档 ping ═══'
for m in fast thinking agent; do
  echo "── $m ──"
  curl -sS --max-time 25 -X POST http://localhost:3001/api/zhihu/chat \
    -H 'Content-Type: application/json' \
    -d "{\"model\":\"$m\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}" \
    2>&1 | head -c 400
  echo; echo
done

echo '═══ 5️⃣ 模拟真实 PK 指令（fast 档·opening） ═══'
curl -sS --max-time 45 -X POST http://localhost:3001/api/zhihu/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"fast","messages":[{"role":"user","content":"[辩题:MBTI 测试是否科学] [阶段:开篇立论] [正方]\n你是辩论选手，请用 2~4 句口语短句完成开篇立论。辩题/立场已在系统里给齐，直接开口。"}]}' \
  2>&1 | head -c 1500
echo

echo
echo '═══ 6️⃣ 知识库/搜索类 API ═══'
for ep in /api/zhihu/search /api/knowledge/search /api/kb/search /api/kb/cite; do
  echo "── $ep ──"
  curl -sS --max-time 8 -o /dev/null -w 'http=%{http_code} time=%{time_total}s\n' "http://localhost:3001$ep?q=MBTI&limit=3" 2>&1
done

echo
echo '═══ 7️⃣ 关键 API 健康 ═══'
for ep in /api/health /api/scenes /api/topics /api/pk/rooms; do
  echo -n "── $ep "
  curl -sS -o /dev/null -w 'http=%{http_code} t=%{time_total}s\n' --max-time 5 "http://localhost:3001$ep"
done

echo
echo '═══ 8️⃣ 错误日志（近 2h） ═══'
journalctl -u mbti-debate.service --since '2 hours ago' --no-pager 2>/dev/null \
  | grep -iE 'Error|throw|TypeError|直答限流|降级|401|429|500' \
  | grep -v 'GET /api/zhihu/status' | tail -25
echo '── done ──'
