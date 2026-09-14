-- 测试数据清理（ztest% / zauto% / zaudit% 账号及其产生的房间、帖子、发言、裁判、总结）
-- 账号命名约定：ztest*=人类PK测试、zauto*=自动模式测试、zaudit*=全功能审计
PRAGMA foreign_keys = ON;

-- 条件复用：把测试账号集合写成公共前缀判断
--   注意 LIKE 里 _ 是通配符，用 ESCAPE 转义
-- 1) 测试用户创建的房间 → 先清关联表再删房（避开外键/孤儿）
DELETE FROM pk_moves        WHERE room_id IN (SELECT id FROM pk_rooms WHERE creator_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%'));
DELETE FROM pk_participants WHERE room_id IN (SELECT id FROM pk_rooms WHERE creator_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%'));
DELETE FROM pk_judge_results WHERE room_id IN (SELECT id FROM pk_rooms WHERE creator_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%'));
DELETE FROM pk_summaries    WHERE room_id IN (SELECT id FROM pk_rooms WHERE creator_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%'));
DELETE FROM pk_rooms        WHERE creator_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%');

-- 2) 测试帖（含其评论）
DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE title LIKE '并发测试帖%' OR title LIKE '审计帖%' OR user_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%'));
DELETE FROM posts    WHERE title LIKE '并发测试帖%' OR title LIKE '审计帖%' OR user_id IN (SELECT id FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%');

-- 3) 测试账号（级联清理其剩余参与者/发言等）
DELETE FROM users WHERE username LIKE 'ztest%' OR username LIKE 'zauto%' OR username LIKE 'zaudit%';

-- 4) 回收超期等待房（>15 分钟），避免再次吸人
UPDATE pk_rooms SET current_phase = 'finished'
WHERE current_phase = 'waiting' AND is_public = 1
  AND created_at < (strftime('%s','now') * 1000 - 900000);

-- 5) 孤儿数据兜底：指向不存在用户的参与者/发言
DELETE FROM pk_participants WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM pk_moves        WHERE user_id NOT IN (SELECT id FROM users) AND user_id NOT LIKE 'ai\_\_%' ESCAPE '\';
