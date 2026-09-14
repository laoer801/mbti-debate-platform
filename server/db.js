import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 支持 Electron 桌面版通过 MBTI_DATA_DIR 覆盖数据目录（持久化到用户目录，避免 portable 临时目录丢数据）
const DATA_DIR = process.env.MBTI_DATA_DIR
  ? path.resolve(process.env.MBTI_DATA_DIR)
  : path.join(__dirname, 'data')

let db

export function getDB() {
  return db
}

export async function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  const dbPath = path.join(DATA_DIR, 'debate.db')
  console.log(`Database path: ${dbPath}`)
  
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      scene_id TEXT,
      participants TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type_id TEXT NOT NULL,
      type_name TEXT NOT NULL,
      type_emoji TEXT NOT NULL,
      type_color TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence INTEGER,
      is_user INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      mbti_type TEXT,
      avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      banned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'INFP',
      author_emoji TEXT NOT NULL DEFAULT '🦋',
      author_color TEXT NOT NULL DEFAULT '#9b59b6',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      is_ai INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_type TEXT NOT NULL DEFAULT 'INFP',
      author_emoji TEXT NOT NULL DEFAULT '🦋',
      author_color TEXT NOT NULL DEFAULT '#9b59b6',
      content TEXT NOT NULL,
      is_ai INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      post_id TEXT,
      comment_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_users_mbti ON users(mbti_type);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique ON likes(user_id, COALESCE(post_id, ''), COALESCE(comment_id, ''));

    -- ============================================================
    -- 人格知识库 (Personality Knowledge Base)
    -- 五层架构：身份 → 认知 → 说话风格 → 价值观 → 核心指令
    -- ============================================================

    CREATE TABLE IF NOT EXISTS personality_profiles (
      type_id TEXT PRIMARY KEY,
      type_name TEXT NOT NULL,
      type_emoji TEXT NOT NULL,
      type_color TEXT NOT NULL,
      group_name TEXT NOT NULL,
      identity_statement TEXT NOT NULL,
      energy_source TEXT NOT NULL,
      info_processing TEXT NOT NULL,
      decision_style TEXT NOT NULL,
      life_style TEXT NOT NULL,
      tone TEXT NOT NULL,
      word_preference TEXT NOT NULL,
      sentence_pattern TEXT NOT NULL,
      catchphrases TEXT NOT NULL DEFAULT '[]',
      emotion_expression TEXT NOT NULL,
      core_values TEXT NOT NULL DEFAULT '[]',
      blind_spots TEXT NOT NULL DEFAULT '[]',
      core_instructions TEXT NOT NULL DEFAULT '[]',
      debate_stances TEXT NOT NULL DEFAULT '[]',
      avg_sentence_length INTEGER DEFAULT 15,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS few_shot_examples (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      category TEXT NOT NULL,
      scenario TEXT NOT NULL,
      user_input TEXT NOT NULL,
      personality_response TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      FOREIGN KEY (type_id) REFERENCES personality_profiles(type_id)
    );

    CREATE TABLE IF NOT EXISTS personality_reflections (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_desc TEXT NOT NULL,
      reflection_text TEXT NOT NULL,
      FOREIGN KEY (type_id) REFERENCES personality_profiles(type_id)
    );

    CREATE TABLE IF NOT EXISTS kb_resources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      description TEXT,
      url TEXT,
      is_loaded INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_few_shot_type ON few_shot_examples(type_id);
    CREATE INDEX IF NOT EXISTS idx_reflections_type ON personality_reflections(type_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_group ON personality_profiles(group_name);

    -- ============================================================
    -- 辩论PK房间系统
    -- ============================================================

    CREATE TABLE IF NOT EXISTS pk_rooms (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      position TEXT DEFAULT '正方',
      current_phase TEXT DEFAULT 'waiting',
      is_public INTEGER DEFAULT 1,
      max_participants INTEGER DEFAULT 2,
      creator_id TEXT,
      winner_id TEXT,
      phase_started_at INTEGER,
      phase_duration INTEGER DEFAULT 0,
      started_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pk_participants (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      side TEXT NOT NULL DEFAULT 'pro',
      status TEXT DEFAULT 'joined',
      joined_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES pk_rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pk_moves (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      move_type TEXT DEFAULT 'speech',
      phase TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES pk_rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pk_judge_results (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL UNIQUE,
      scores TEXT NOT NULL,
      winner_id TEXT,
      feedback TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES pk_rooms(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pk_rooms_phase ON pk_rooms(current_phase);
    CREATE INDEX IF NOT EXISTS idx_pk_participants_room ON pk_participants(room_id);
    CREATE INDEX IF NOT EXISTS idx_pk_participants_user ON pk_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_pk_moves_room ON pk_moves(room_id);

    -- ============================================================
    -- v40 PK 宠物战斗快照（服务器权威）
    -- preparation 阶段对双方宠物做属性快照（含装备加成），
    -- 之后的伤害计算/HP 扣减全部由服务端完成并广播，两端一致
    -- ============================================================

    CREATE TABLE IF NOT EXISTS pk_battle_state (
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sprite_type TEXT NOT NULL,
      emoji TEXT DEFAULT '🐱',
      hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL,
      atk INTEGER NOT NULL,
      def INTEGER NOT NULL,
      spd INTEGER NOT NULL,
      damage_dealt INTEGER DEFAULT 0,
      damage_taken INTEGER DEFAULT 0,
      is_temp INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (room_id, user_id),
      FOREIGN KEY (room_id) REFERENCES pk_rooms(id) ON DELETE CASCADE
    );

    -- ============================================================
    -- 像素宠物系统
    -- ============================================================

    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sprite_type TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🐱',
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      atk INTEGER DEFAULT 10,
      def INTEGER DEFAULT 5,
      spd INTEGER DEFAULT 10,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pet_currencies (
      user_id TEXT PRIMARY KEY,
      points INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pet_inventory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pet_equipped (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      equipped_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_pets_user ON pets(user_id);
    CREATE INDEX IF NOT EXISTS idx_pet_inv_user ON pet_inventory(user_id);
    CREATE INDEX IF NOT EXISTS idx_pet_eq_user ON pet_equipped(user_id);

    -- ============================================================
    -- 用户数据云同步（"用户信息跟随账号"）
    -- 用户自建书籍 + 历史辩论会话，跨设备/跨版本跟随账号
    -- ============================================================

    CREATE TABLE IF NOT EXISTS user_books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      theme TEXT DEFAULT '',
      accent TEXT DEFAULT '#6366f1',
      notes TEXT DEFAULT '',
      quotes TEXT DEFAULT '[]',
      added_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_debate_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      mode TEXT DEFAULT 'free',
      scene_id TEXT,
      participants TEXT DEFAULT '[]',
      messages TEXT DEFAULT '[]',
      highlights TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_books_user ON user_books(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_debate_sessions(user_id);

    -- ============================================================
    -- v40.6 知乎账号绑定（cookie 注入方案）
    -- 用户粘贴知乎 z_c0 cookie → 后端加密存储 → 用于调知乎 API（收藏夹同步/身份登录）
    -- 一个用户对应一个知乎账号；解绑即清空记录
    -- ============================================================

    CREATE TABLE IF NOT EXISTS user_zhihu_bindings (
      user_id TEXT PRIMARY KEY,
      zhihu_user_id TEXT NOT NULL,
      zhihu_username TEXT DEFAULT '',
      zhihu_avatar TEXT DEFAULT '',
      z_c0_ciphertext TEXT NOT NULL,    -- AES-256-GCM 加密后的 z_c0 cookie
      z_c0_iv TEXT NOT NULL,           -- GCM IV（base64）
      z_c0_tag TEXT NOT NULL,          -- GCM 认证标签（base64）
      status TEXT DEFAULT 'active',     -- active / expired / revoked
      bound_at INTEGER NOT NULL,
      last_used_at INTEGER,
      last_verify_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_zhihu_bindings_zhihu ON user_zhihu_bindings(zhihu_user_id);

    -- 同步任务流水：每次"同步到知乎收藏夹"留痕，便于排查失败
    CREATE TABLE IF NOT EXISTS zhihu_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,          -- answer / article / question
      item_id TEXT NOT NULL,
      target_favlist_id INTEGER NOT NULL,
      status TEXT NOT NULL,             -- success / failed / skipped
      message TEXT DEFAULT '',
      synced_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_zhihu_sync_log_user ON zhihu_sync_log(user_id, synced_at DESC);

    -- ============================================================
    -- v35 多人在线 + 后台管理（SaaS 化增量）
    -- 内容管理：辩论主题 / 人格提示词覆盖 / 使用统计
    -- ============================================================

    CREATE TABLE IF NOT EXISTS debate_topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      sides TEXT DEFAULT '[]',
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS persona_overrides (
      type_id TEXT PRIMARY KEY,
      system_prompt_override TEXT DEFAULT '',
      path_advice_override TEXT DEFAULT '',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      event TEXT NOT NULL,
      payload TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS news_articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      content TEXT DEFAULT '',
      link TEXT DEFAULT '',
      source TEXT NOT NULL,
      category TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      published_at INTEGER,
      fetched_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_news_fetched ON news_articles(fetched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);

    -- ============================================================
    -- v40.1 人格强度校准（双轨模型基线）
    -- 用户跑完 60 题量表后，结果存这里，供人格卡片"强度仪表"展示
    -- ============================================================

    CREATE TABLE IF NOT EXISTS persona_calibration (
      user_id TEXT NOT NULL,
      type_id TEXT NOT NULL,
      e_score INTEGER NOT NULL,
      n_score INTEGER NOT NULL,
      t_score INTEGER NOT NULL,
      j_score INTEGER NOT NULL,
      result_type TEXT NOT NULL,
      intensity_score INTEGER NOT NULL,
      filled_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, type_id)
    );
    CREATE INDEX IF NOT EXISTS idx_calibration_user ON persona_calibration(user_id);

    -- ============================================================
    -- v40.2 七维裁判配置（admin 可调）
    -- ============================================================

    CREATE TABLE IF NOT EXISTS judge_rubric (
      version TEXT PRIMARY KEY,
      rubric_json TEXT NOT NULL,
      created_by TEXT,
      total_passed INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rubric_active ON judge_rubric(is_active);

    CREATE TABLE IF NOT EXISTS judge_verdicts (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      rubric_version TEXT NOT NULL,
      judge_json TEXT NOT NULL,
      consensus_json TEXT NOT NULL,
      verdict_text TEXT NOT NULL,
      citations_json TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (rubric_version) REFERENCES judge_rubric(version)
    );
    CREATE INDEX IF NOT EXISTS idx_verdicts_session ON judge_verdicts(session_id);
    CREATE INDEX IF NOT EXISTS idx_verdicts_created ON judge_verdicts(created_at DESC);

    -- ============================================================
    -- v40.3 用户上传文件 + 检索（替代 localStorage 学习库）
    -- ============================================================

    CREATE TABLE IF NOT EXISTS uploaded_docs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      remote_kb_id TEXT,
      remote_kb_url TEXT,
      file_size INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'indexing',
      error_message TEXT,
      indexed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_uploaded_docs_user ON uploaded_docs(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_docs_status ON uploaded_docs(status);

    CREATE TABLE IF NOT EXISTS uploaded_chunks (
      id TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      content_tsv TEXT,
      FOREIGN KEY (doc_id) REFERENCES uploaded_docs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON uploaded_chunks(doc_id);
  `)

  // 二次插入：仅在表为空时插入种子（用 stmt API 保证 NOW 正确传入）
  try {
    const rubricCount = db.prepare('SELECT COUNT(*) as c FROM judge_rubric').get()
    if (rubricCount.c === 0) {
      const insertRubric = db.prepare(`
        INSERT INTO judge_rubric (version, rubric_json, is_active, created_at)
        VALUES (?, ?, ?, ?)
      `)
      const now = Date.now()
      insertRubric.run('legacy-5d',
        JSON.stringify({ version: 'legacy-5d', dimensions: { logic: 0.25, evidence: 0.20, rebuttal: 0.25, clarity: 0.15, demeanor: 0.15 }, scale: 100 }),
        0, now)
      insertRubric.run('7d-v1',
        JSON.stringify({ version: '7d-v1', dimensions: { logic: 0.18, evidence: 0.15, rebuttal: 0.15, clarity: 0.10, demeanor: 0.10, rhetoric: 0.12, strategy: 0.10, ethics: 0.10 }, scale: 100 }),
        1, now)
    }
  } catch (e) {
    console.log('judge_rubric seed:', e.message)
  }

  // FTS5 全文虚拟表（放在 db.exec 外面执行，因为 better-sqlite3 不允许 CREATE VIRTUAL TABLE 内嵌在 db.exec 里包含 tokenizer 字符处理）
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS uploaded_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        doc_id UNINDEXED,
        title,
        content,
        tokenize='unicode61'
      );
    `)
  } catch (e) {
    console.log('FTS5 初始化提示（可忽略）：', e.message)
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_citations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        doc_id TEXT NOT NULL,
        chunk_id TEXT,
        ref_text TEXT NOT NULL,
        context TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (doc_id) REFERENCES uploaded_docs(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_citations_user ON user_citations(user_id);
      CREATE INDEX IF NOT EXISTS idx_citations_session ON user_citations(session_id, created_at);
    `)
  } catch (e) {
    console.log('user_citations 初始化提示：', e.message)
  }

  // 已有数据库迁移：users 表补 role / banned 列（老库无此列时执行，幂等）
  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
  } catch { /* 列已存在 */ }
  try {
    db.exec("ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0")
  } catch { /* 列已存在 */ }

  // v40.6：PK AI 对战 —— pk_rooms 补 ai_mode / ai_level 列（幂等迁移）
  try {
    db.exec("ALTER TABLE pk_rooms ADD COLUMN ai_mode INTEGER DEFAULT 0")
  } catch { /* 列已存在 */ }
  try {
    db.exec("ALTER TABLE pk_rooms ADD COLUMN ai_level TEXT DEFAULT NULL")
  } catch { /* 列已存在 */ }
  // v40.6.3：回合制发言权（AI 对战用；真人房为 NULL 保持自由发言）
  try {
    db.exec("ALTER TABLE pk_rooms ADD COLUMN turn_user_id TEXT DEFAULT NULL")
  } catch { /* 列已存在 */ }
  // v40.6：AI 对手静默学习用户表达风格（不展示，仅服务端 AI 发言风格使用）
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_learner_styles (
        user_id TEXT PRIMARY KEY,
        move_count INTEGER DEFAULT 0,
        total_chars INTEGER DEFAULT 0,
        avg_len REAL DEFAULT 0,
        q_len INTEGER DEFAULT 0,     -- 问句条数
        ex_len INTEGER DEFAULT 0,    -- 感叹句条数
        list_hits INTEGER DEFAULT 0, -- 分点/列举命中（①②③/首先/其次/第一等）
        emoji_hits INTEGER DEFAULT 0,
        followup_hits INTEGER DEFAULT 0, -- 承接词（所以/因此/不过/但是）
        last_text TEXT,
        updated_at INTEGER NOT NULL
      )
    `)
  } catch (e) {
    console.log('ai_learner_styles 初始化提示：', e.message)
  }

  // Seed knowledge base data if empty
  try {
    const { seedKnowledgeBase, seedKBResources } = await import('./seeds/personalities.js')
    seedKnowledgeBase(db)
    seedKBResources(db)
  } catch (e) {
    console.log('种子数据加载提示:', e.message)
  }

  console.log('Database initialized successfully')
  return db
}
