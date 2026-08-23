# DebateSphere「思辩星球」v40 — PK 实时对战 · 宠物战斗系统

> 版本：v40.0.0 ｜ 日期：2026-08-22
> 主题：修复 PK 房间三大缺陷 —— 语音输入不可用、宠物擂台不可见、攻击是假动画

---

## 一、本次解决的三个问题

| # | 用户报告 | 根因 | 修复方案 |
|---|----------|------|----------|
| 1 | PK 不能语音输入 | Web Speech API 只在 localhost/HTTPS（安全上下文）可用，手机 `http://IP:3001` 访问被浏览器**静默封锁**，且 onerror 无任何提示 | ① VoiceInput 错误可视化（非安全上下文/权限拒绝/设备缺失各有明确文案）② 服务端新增 **HTTPS 3443 端口**（自签证书自动生成）③ Electron 增加麦克风权限 handler |
| 2 | 宠物擂台看不到 | PetBattleField 挂在 `overflow-hidden` 容器底部的**绝对定位 0 高度容器**里，且要求**双方都有宠物**才渲染 | 重写为布局流内的顶部擂台条（恒定占位）；无快照时显示待命占位条，不再消失 |
| 3 | 攻击功能没实现 | 伤害是**客户端本地随机数**（两端数字不一致）、HP 永不掉、从不调用 battle-result 结算 | **服务器权威战斗系统**：伤害由服务端计算并广播，两端画面一致 |

---

## 二、服务器权威战斗系统（核心架构）

### 数据流

```
preparation 阶段切换
  └→ initBattleState(): 锁定双方宠物快照（含装备加成，HP=max_hp 满血开战）
      └→ socket 广播 battle-init ──→ 两端擂台渲染

每次发言 POST /move
  └→ applyPetAttack(): 服务器计算伤害 → 更新 pk_battle_state（HP/累计输出/承伤）
      └→ socket 广播 pet-battle ──→ 两端播放攻击动画 + 伤害数字 + HP 条

judge 评分
  └→ settlePetBattle(): 每位玩家结算经验/积分/胜负/升级（复用宠物系统逻辑）
      └→ 战报追加到裁判 feedback（## 🐾 宠物战报）
```

### 伤害公式（发言质量决定输出）

```
base    = max(1, atk_total − def_total / 2)
质量乘数 = 0.7 + min(0.8, 字数/150)          ← 发言长度
         + 0.3 (含反驳词：不对/然而/相反...)   ← 反驳加成
         + 0.2 (含论据词：根据/数据/研究...)   ← 论据加成
随机    = 0.85 ~ 1.15
暴击率  = spd / 200（上限 40%）→ 伤害 ×1.5
```

### 关键设计决策

- **无宠物玩家获得临时「辩灵」**（slime 外观，不落库）：保证擂台永远可战，judge 结算时自动跳过
- **快照 HP 用 max_hp**：擂台是本场战斗的独立血条，不沿用宠物的野外残血；结算时才把 damage_taken 应用到真实宠物（下限 1，宠物不死）
- **http/https 同一 socket.io 实例**（`io.attach(httpsServer)`）：3443 和 3001 的用户进同一房间，在线状态不分裂
- **judge 幂等保留**：重复评分不会重复发经验（E2E 已验证）

---

## 三、改动文件清单

### 服务端
| 文件 | 改动 |
|------|------|
| `server/db.js` | 新增 `pk_battle_state` 表（room_id+user_id 复合主键，属性快照 + damage_dealt/taken + is_temp） |
| `server/routes/pets.js` | 结算逻辑抽取为导出函数 `settlePetBattle`；新增 `getPetWithBonus`/`getEquippedBonus`；`/battle-result` 改为复用 |
| `server/routes/pk-rooms.js` | preparation 初始化快照并广播 `battle-init`；`/move` 计算伤害并广播 `pet-battle`；`/judge` 宠物结算+战报；新增 `GET /:roomId/battle`（断线重连） |
| `server/index.js` | HTTPS 自签证书（openssl，10 年）+ 3443 端口 + 启动日志打印语音专用地址 |

### 客户端
| 文件 | 改动 |
|------|------|
| `client/src/types/index.ts` | 新增 `BattleState` / `PetBattleEvent` 接口 |
| `client/src/components/PetBattleField.tsx` | **完全重写**：布局流内顶部擂台条；服务器权威 HP 驱动；攻击/受击/暴击动画；KO 状态；空位占位 |
| `client/src/components/PKRoom.tsx` | 订阅 `battle-init`/`pet-battle`；断线重连恢复快照；擂台挂载点移到参与者栏下方 |
| `client/src/components/VoiceInput.tsx` | 错误全部可视化（非安全上下文提示 HTTPS 地址、权限拒绝、无麦克风、Electron 不支持）；no-speech/aborted 静默 |

### 桌面端
| 文件 | 改动 |
|------|------|
| `desktop/main.js` | `setPermissionRequestHandler` + `setPermissionCheckHandler` 允许麦克风 |

---

## 四、E2E 验证（pk-battle-e2e.mjs，18/18 通过）

1. ✅ 双账号注册 + A 创建像素猫 / B 无宠物
2. ✅ preparation 快照：A=像素猫满血（含装备加成 atk），B=临时辩灵（isTemp）
3. ✅ A 发言 → 服务器算出 damage=8，defenderHp = maxHp − damage 精确匹配
4. ✅ B 反驳发言 → 反驳词加成生效，攻击反向
5. ✅ `GET /battle` 重连接口返回扣减后 HP + 累计承伤
6. ✅ judge → feedback 含「🐾 宠物战报」（伤害/经验/积分/升级）
7. ✅ A 宠物 exp=110、升级 Lv.2 实际入账；重复 judge 幂等（exp 不重复）
8. ✅ HTTPS 3443 端口 health check 200
9. ✅ tsc 0 错误、vite build 通过、新逻辑确认进入产物

---

## 五、手机语音输入使用说明

1. 电脑启动后端：`cd server && npm start`
2. 启动日志会打印两组地址：
   - `http://IP:3001` —— 普通访问（语音不可用）
   - `https://IP:3443` —— **语音输入专用**
3. 手机浏览器打开 `https://IP:3443` → 提示证书不受信任 → 点「高级 → 继续前往」
4. 进 PK 房间点 🎤 → 首次弹窗允许麦克风 → 实时转文字进输入框，同时广播给对方

> 桌面版 Electron 中 Chrome 语音服务不可用（无 Google API key），会提示改用键盘输入。

---

## 六、交付物

- `DebateSphere-v40-portable.exe` —— Windows 便携版
- `DebateSphere-v40-setup.exe` —— Windows 安装版
- APK（debug/release）—— Android 客户端
- 位置：项目根目录 + artifacts\ + 桌面

---

## 七、后续建议

- [ ] 语音输入在 iOS Safari 完全不可用（WebView 限制），可考虑接入付费 ASR API 兜底
- [ ] 宠物技能道具（护盾/回血）尚未在 PK 战斗中生效，可扩展为 preparation 阶段使用
- [ ] 擂台 KO 后可加「援护」机制（临时辩灵复活一次）
