/**
 * MBTI 知识库种子数据加载器
 * 从 kb_seed.json 读取数据注入 SQLite 数据库
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOW = Date.now()

export function seedKnowledgeBase(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM personality_profiles').get()
  if (count.c > 0) {
    console.log(`知识库已有 ${count.c} 条人格数据，跳过种子注入`)
    return
  }

  const dataPath = path.join(__dirname, 'kb_seed.json')
  if (!fs.existsSync(dataPath)) {
    console.log('kb_seed.json 不存在，跳过种子注入')
    return
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const insertProfile = db.prepare(`INSERT INTO personality_profiles 
    (type_id, type_name, type_emoji, type_color, group_name, identity_statement,
     energy_source, info_processing, decision_style, life_style,
     tone, word_preference, sentence_pattern, catchphrases, emotion_expression,
     core_values, blind_spots, core_instructions, debate_stances, avg_sentence_length, created_at)
    VALUES (@type_id, @type_name, @type_emoji, @type_color, @group_name, @identity_statement,
     @energy_source, @info_processing, @decision_style, @life_style,
     @tone, @word_preference, @sentence_pattern, @catchphrases, @emotion_expression,
     @core_values, @blind_spots, @core_instructions, @debate_stances, @avg_sentence_length, @created_at)`)

  const insertFewShot = db.prepare(`INSERT INTO few_shot_examples 
    (id, type_id, category, scenario, user_input, personality_response, priority)
    VALUES (@id, @type_id, @category, @scenario, @user_input, @personality_response, @priority)`)

  const tx = db.transaction(() => {
    for (const p of data.profiles) {
      insertProfile.run({
        ...p,
        catchphrases: JSON.stringify(p.catchphrases),
        core_values: JSON.stringify(p.core_values),
        blind_spots: JSON.stringify(p.blind_spots),
        core_instructions: JSON.stringify(p.core_instructions),
        debate_stances: JSON.stringify(p.debate_stances),
        created_at: NOW,
      })
    }
    data.fewshots.forEach((s, i) => {
      insertFewShot.run({ ...s, id: `fs_${i}` })
    })
  })
  tx()

  console.log(`✅ 注入 ${data.profiles.length} 种人格五层结构`)
  console.log(`✅ 注入 ${data.fewshots.length} 条 Few-shot 对话示例`)
}

export function seedKBResources(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM kb_resources').get()
  if (count.c > 0) return

  const dataPath = path.join(__dirname, 'kb_seed.json')
  if (!fs.existsSync(dataPath)) return

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const insert = db.prepare(`INSERT INTO kb_resources (id, name, resource_type, description, url, is_loaded) VALUES (?, ?, ?, ?, ?, ?)`)
  const tx = db.transaction(() => {
    for (const r of data.resources) {
      insert.run(r.id, r.name, r.resource_type, r.description, r.url, r.is_loaded)
    }
  })
  tx()
  console.log(`✅ 注入 ${data.resources.length} 条知识库资源引用`)
}
