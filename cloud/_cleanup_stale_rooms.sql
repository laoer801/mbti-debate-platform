-- 收尾「人类已离开、只剩 AI 或已空」的未结束房间
-- 目的：这些房不会再有人回来，若残留未结束状态容易被误认为"进行中"，也可能在自动推进下空跑消耗 LLM
PRAGMA foreign_keys = ON;

-- 注意 ESCAPE：ai 影子账号前缀是 ai__ ，下划线在 LIKE 里是通配符，必须转义
UPDATE pk_rooms
SET current_phase = 'finished'
WHERE current_phase NOT IN ('waiting', 'finished')
  AND (
    SELECT COUNT(*) FROM pk_participants p
    WHERE p.room_id = pk_rooms.id
      AND p.user_id NOT LIKE 'ai\_\_%' ESCAPE '\'
  ) = 0;

-- 顺带清理：完全没有参与者的房间
DELETE FROM pk_moves        WHERE room_id IN (SELECT r.id FROM pk_rooms r WHERE (SELECT COUNT(*) FROM pk_participants p WHERE p.room_id = r.id) = 0);
DELETE FROM pk_judge_results WHERE room_id IN (SELECT r.id FROM pk_rooms r WHERE (SELECT COUNT(*) FROM pk_participants p WHERE p.room_id = r.id) = 0);
DELETE FROM pk_summaries    WHERE room_id IN (SELECT r.id FROM pk_rooms r WHERE (SELECT COUNT(*) FROM pk_participants p WHERE p.room_id = r.id) = 0);
DELETE FROM pk_rooms        WHERE (SELECT COUNT(*) FROM pk_participants p WHERE p.room_id = pk_rooms.id) = 0;

-- 超期等待房回收（>15 分钟，避免吸人）
UPDATE pk_rooms SET current_phase = 'finished'
WHERE current_phase = 'waiting' AND is_public = 1
  AND created_at < (strftime('%s','now') * 1000 - 900000);
