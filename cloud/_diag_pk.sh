#!/bin/bash
# PK 路径诊断：抓实际发往 LLM 的 prompt 和 AI 回复
# 用法: bash /opt/mbti/_diag_pk.sh

set -e
LOG=/tmp/pk_diag.log
: > $LOG

echo "═══ 模拟一次 PK AI 开场发言（fast 档） ═══" | tee -a $LOG
echo "" | tee -a $LOG

# 走一个非破坏性的方式：直接调用 /api/zhihu/chat 模拟 buildAIMessages 的真实组装
# 1. 取一个最近 PK 房间的 topic
TOPIC=$(sqlite3 /opt/mbti/data/debate.db "SELECT topic FROM pk_rooms WHERE ai_mode=1 ORDER BY created_at DESC LIMIT 1;" 2>/dev/null)
echo "── 抓取到的 topic：$TOPIC" | tee -a $LOG

# 2. 模拟 buildAIMessages 输出的 user content（fast 档 opening 阶段，正方）
USER_CONTENT="[辩题:$TOPIC]
[阶段:开篇立论]
[正方]
[你的身份:正方选手]

请用 2~4 句自然口语短句完成你的立论开口。直接基于已给的辩题和阶段开始发言——禁止询问辩题、搜索参考、资料或正方立场。"

echo "" | tee -a $LOG
echo "── 实际发给 LLM 的 user content ──" | tee -a $LOG
echo "$USER_CONTENT" | tee -a $LOG
echo "" | tee -a $LOG

# 3. 模拟完整 messages 数组（fast 档有 system + user 两层）
echo "── 调用 /api/zhihu/chat (model=fast) ──" | tee -a $LOG
RESP=$(curl -sS --max-time 35 -X POST http://localhost:3001/api/zhihu/chat \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"fast\",\"messages\":[{\"role\":\"user\",\"content\":$(printf '%s' "$USER_CONTENT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}]}" 2>&1)
echo "$RESP" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print("  model:", d.get("model")); print("  content:", d.get("content","")[:300])' 2>&1 | tee -a $LOG
echo "" | tee -a $LOG

# 4. 跟"用 system + user"两层对比（模拟真实 buildAIMessages 结构）
echo "── 完整 system + user 两层模拟 ──" | tee -a $LOG
SYSTEM_CONTENT="你是辩论选手。辩题：${TOPIC}。你是正方。请按阶段要求发言。"
RESP2=$(curl -sS --max-time 35 -X POST http://localhost:3001/api/zhihu/chat \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"fast\",\"messages\":[{\"role\":\"system\",\"content\":$(printf '%s' "$SYSTEM_CONTENT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')},{\"role\":\"user\",\"content\":$(printf '%s' "$USER_CONTENT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}]}" 2>&1)
echo "$RESP2" | python3 -c 'import sys,json; d=json.loads(sys.stdin.read()); print("  model:", d.get("model")); print("  content:", d.get("content","")[:300])' 2>&1 | tee -a $LOG
echo "" | tee -a $LOG

echo "═══ 完成 ═══" | tee -a $LOG