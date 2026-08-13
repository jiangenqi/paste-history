const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(process.env.APPDATA, 'ClipHistory');
const DB_PATH = path.join(DATA_DIR, 'data.db');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

let db = null;
let SQL = null;

// 校验图片路径是否位于应用数据目录内，防止 data.db 被篡改后越界读写磁盘文件
function isImagePathSafe(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return false;
  const resolved = path.resolve(imagePath);
  const root = path.resolve(IMAGES_DIR);
  return resolved === root || resolved.startsWith(root + path.sep);
}

// 删除图片文件（仅限数据目录内的路径）
function safeUnlinkImage(imagePath) {
  try {
    if (isImagePathSafe(imagePath) && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  } catch (e) {
    console.error('Delete image failed:', imagePath, e.message);
  }
}

// --- 初始化 ---

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function saveToDisk() {
  if (!db) return;
  try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
  catch (e) { console.error('Save failed:', e.message); }
}

async function initDB() {
  if (db) return db;
  ensureDirectories();

  const sqlJsDir = path.dirname(require.resolve('sql.js'));
  SQL = await initSqlJs({ locateFile: () => path.join(sqlJsDir, 'sql-wasm.wasm') });

  if (fs.existsSync(DB_PATH)) {
    try { db = new SQL.Database(fs.readFileSync(DB_PATH)); }
    catch (e) { console.error('Load DB failed:', e.message); db = new SQL.Database(); }
  } else {
    db = new SQL.Database();
  }

  createTables();
  return db;
}

function getDB() {
  if (!db) throw new Error('Database not initialized.');
  return db;
}

// --- 建表 ---

function createTables() {
  // 分类表
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT    NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clips (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL,
      content     TEXT,
      image_path  TEXT,
      image_hash  TEXT,
      dimensions  TEXT,
      image_seq   INTEGER,
      created_at  TEXT    NOT NULL,
      pinned      INTEGER DEFAULT 0,
      favorite    INTEGER DEFAULT 0,
      deleted     INTEGER DEFAULT 0
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips(created_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_clips_pinned ON clips(pinned)');
  db.run('CREATE INDEX IF NOT EXISTS idx_clips_deleted ON clips(deleted)');
  try { db.run('ALTER TABLE clips ADD COLUMN favorite INTEGER DEFAULT 0'); } catch (e) { /* 已存在 */ }
  try { db.run('ALTER TABLE clips ADD COLUMN dimensions TEXT'); } catch (e) { /* 已存在 */ }
  try { db.run('ALTER TABLE clips ADD COLUMN image_seq INTEGER'); } catch (e) { /* 已存在 */ }
  try { db.run('ALTER TABLE clips ADD COLUMN category_id INTEGER DEFAULT NULL'); } catch (e) { /* 已存在 */ }

  // 多分类关联表（支持一个剪贴属于多个分类）
  db.run(`
    CREATE TABLE IF NOT EXISTS clip_categories (
      clip_id     INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (clip_id, category_id)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_clip_categories_clip ON clip_categories(clip_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_clip_categories_cat ON clip_categories(category_id)');

  // 迁移旧数据：将 clips.category_id 迁移到 clip_categories 表
  try {
    db.run(`
      INSERT OR IGNORE INTO clip_categories (clip_id, category_id)
      SELECT id, category_id FROM clips WHERE category_id IS NOT NULL
    `);
  } catch (e) { /* 迁移失败不阻塞 */ }

  // 清理历史 bug 产生的脏数据：关联到不存在分类（如 category_id=0）的记录
  try {
    db.run(`
      DELETE FROM clip_categories
      WHERE category_id NOT IN (SELECT id FROM categories)
    `);
    db.run(`
      UPDATE clips SET category_id = NULL
      WHERE category_id IS NOT NULL
        AND category_id NOT IN (SELECT id FROM categories)
    `);
  } catch (e) { /* 清理失败不阻塞 */ }

  saveToDisk();
}

// --- 参数化查询工具（替代不支持的 db.exec(sql, params)）---

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  // 关键：必须在 saveToDisk() 之前读取 last_insert_rowid！
  // db.export() 会关闭并重开底层 SQLite 连接，重开后 last_insert_rowid() 归零，
  // 导致 addTextClip / createCategory 等返回 id=0，分类关联写入不存在的分类。
  const id = queryOne('SELECT last_insert_rowid() as id').id;
  saveToDisk();
  return id;
}

// ==================== CRUD ====================

function addTextClip(content) {
  const last = queryOne(
    "SELECT content FROM clips WHERE type='text' AND deleted=0 ORDER BY created_at DESC LIMIT 1"
  );
  if (last && last.content === content) return null;

  const now = new Date().toISOString();
  const newId = run('INSERT INTO clips (type, content, created_at) VALUES (?, ?, ?)', ['text', content, now]);
  return { id: newId, type: 'text', content, created_at: now, pinned: 0 };
}

function addImageClip(imagePath, imageHash, dimensions = null) {
  const row = queryOne(
    'SELECT id FROM clips WHERE type=? AND image_hash=? AND deleted=0 ORDER BY created_at DESC LIMIT 1',
    ['image', imageHash]
  );
  if (row) return null;

  // 自动编号：取当前最大 seq + 1
  const lastSeq = queryOne("SELECT MAX(image_seq) as max_seq FROM clips WHERE type='image'");
  const seq = (lastSeq && lastSeq.max_seq != null) ? lastSeq.max_seq + 1 : 1;

  const now = new Date().toISOString();
  const newId = run('INSERT INTO clips (type, image_path, image_hash, dimensions, image_seq, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['image', imagePath, imageHash, dimensions, seq, now]);
  return { id: newId, type: 'image', image_path: imagePath, image_hash: imageHash, dimensions, image_seq: seq, created_at: now, pinned: 0 };
}

function addFileClip(filePaths) {
  // 文件复制去重：用路径列表的哈希判断
  const hash = crypto.createHash('md5').update(filePaths.sort().join('|')).digest('hex');
  const row = queryOne(
    "SELECT id FROM clips WHERE type='file' AND image_hash=? AND deleted=0 ORDER BY created_at DESC LIMIT 1",
    [hash]
  );
  if (row) return null;

  const now = new Date().toISOString();
  // content 存储 JSON 路径数组，image_hash 复用为路径哈希
  const newId = run('INSERT INTO clips (type, content, image_hash, created_at) VALUES (?, ?, ?, ?)',
    ['file', JSON.stringify(filePaths), hash, now]);
  return { id: newId, type: 'file', content: JSON.stringify(filePaths), image_hash: hash, created_at: now, pinned: 0 };
}

function getClips(limit = 100, offset = 0) {
  return queryAll(
    `SELECT c.id, c.type, c.content, c.image_path, c.dimensions, c.image_seq,
            c.created_at, c.pinned, c.favorite,
            GROUP_CONCAT(cc.category_id) as category_ids
     FROM clips c
     LEFT JOIN clip_categories cc ON cc.clip_id = c.id
     WHERE c.deleted=0
     GROUP BY c.id
     ORDER BY c.pinned DESC, c.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

function searchClips(keyword, limit = 100) {
  // 转义 LIKE 通配符，让 % 和 _ 按字面匹配
  const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
  const numPat = isNaN(keyword) ? null : parseInt(keyword);
  return queryAll(
    `SELECT c.id, c.type, c.content, c.image_path, c.dimensions, c.image_seq,
            c.created_at, c.pinned, c.favorite,
            GROUP_CONCAT(cc.category_id) as category_ids
     FROM clips c
     LEFT JOIN clip_categories cc ON cc.clip_id = c.id
     WHERE c.deleted=0 AND (c.content LIKE ? ESCAPE '\\' OR c.dimensions LIKE ? ESCAPE '\\' OR c.image_seq=?)
     GROUP BY c.id
     ORDER BY c.pinned DESC, c.created_at DESC
     LIMIT ?`,
    [pattern, pattern, numPat, limit]
  );
}

function togglePin(id) {
  const row = queryOne('SELECT pinned FROM clips WHERE id=?', [id]);
  if (!row) return false;
  const next = row.pinned ? 0 : 1;
  run('UPDATE clips SET pinned=? WHERE id=?', [next, id]);
  return !!next;
}

function toggleFavorite(id) {
  const row = queryOne('SELECT favorite FROM clips WHERE id=?', [id]);
  if (!row) return false;
  const next = row.favorite ? 0 : 1;
  if (next === 0) {
    // 取消收藏时同时清除分类归属，防止重新收藏后残留旧分类
    run('UPDATE clips SET favorite=0, category_id=NULL WHERE id=?', [id]);
    run('DELETE FROM clip_categories WHERE clip_id=?', [id]);
  } else {
    run('UPDATE clips SET favorite=1 WHERE id=?', [id]);
  }
  return !!next;
}

function deleteClip(id) {
  // 删除图片类记录时同步删除本地图片文件，避免磁盘泄漏
  const row = queryOne("SELECT image_path FROM clips WHERE id=? AND type='image'", [id]);
  if (row && row.image_path) safeUnlinkImage(row.image_path);
  run('UPDATE clips SET deleted=1 WHERE id=?', [id]);
  return true;
}

// ==================== 清理 ====================

function cleanExpired(retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const expiredImages = queryAll(
    "SELECT id, image_path FROM clips WHERE deleted=0 AND pinned=0 AND type='image' AND created_at < ?",
    [cutoff]
  );
  for (const img of expiredImages) {
    safeUnlinkImage(img.image_path);
  }

  run('DELETE FROM clips WHERE deleted=0 AND pinned=0 AND created_at < ?', [cutoff]);
  return queryOne('SELECT changes() as count').count;
}

function purgeDeleted() {
  const deletedImages = queryAll("SELECT id, image_path FROM clips WHERE deleted=1 AND type='image'");
  for (const img of deletedImages) {
    safeUnlinkImage(img.image_path);
  }
  run('DELETE FROM clips WHERE deleted=1');
  return queryOne('SELECT changes() as count').count;
}

// ==================== 分类管理 ====================

function getCategories() {
  return queryAll('SELECT id, name, sort_order, created_at FROM categories ORDER BY sort_order ASC, id ASC');
}

function createCategory(name) {
  const now = new Date().toISOString();
  // 先查出最大 sort_order，避免子查询在 sql.js 中的兼容问题
  const row = queryOne('SELECT MAX(sort_order) as max_order FROM categories');
  const sortOrder = (row && row.max_order != null) ? row.max_order + 1 : 0;
  // 用最简单的 INSERT（run 返回真实的自增 id）
  const newId = run('INSERT INTO categories (name, sort_order, created_at) VALUES (?, ?, ?)', [name, sortOrder, now]);
  return { id: newId, name, sort_order: sortOrder, created_at: now };
}

function renameCategory(id, name) {
  run('UPDATE categories SET name=? WHERE id=?', [name, id]);
  return true;
}

function deleteCategory(id) {
  // 清除该分类下所有剪贴的关联
  run('DELETE FROM clip_categories WHERE category_id=?', [id]);
  run('UPDATE clips SET category_id=NULL WHERE category_id=?', [id]);
  run('DELETE FROM categories WHERE id=?', [id]);
  return true;
}

function setClipCategory(clipId, categoryId) {
  // 添加到分类（不覆盖已有分类，支持多分类）
  if (categoryId !== null) {
    const stmt = db.prepare('INSERT OR IGNORE INTO clip_categories (clip_id, category_id) VALUES (?, ?)');
    stmt.bind([clipId, categoryId]);
    stmt.step();
    stmt.free();
    // 同时更新 category_id 作为主分类
    const ustmt = db.prepare('UPDATE clips SET category_id=? WHERE id=?');
    ustmt.bind([categoryId, clipId]);
    ustmt.step();
    ustmt.free();
  }
  saveToDisk();
  return true;
}

function removeClipCategory(clipId, categoryId) {
  run('DELETE FROM clip_categories WHERE clip_id=? AND category_id=?', [clipId, categoryId]);
  // 如果删除的是主分类，切换到另一个分类（如果有）
  const row = queryOne('SELECT category_id FROM clips WHERE id=?', [clipId]);
  if (row && row.category_id == categoryId) {
    const remaining = queryOne(
      'SELECT category_id FROM clip_categories WHERE clip_id=? LIMIT 1', [clipId]
    );
    run('UPDATE clips SET category_id=? WHERE id=?',
      [remaining ? remaining.category_id : null, clipId]);
  }
  saveToDisk();
  return true;
}

function batchSetClipCategory(clipIds, categoryId) {
  // 每条记录使用独立的 prepare → bind → step → free，避免可复用语句在 sql.js 中的兼容问题
  for (const id of clipIds) {
    const stmt = db.prepare('INSERT OR IGNORE INTO clip_categories (clip_id, category_id) VALUES (?, ?)');
    stmt.bind([id, categoryId]);
    stmt.step();
    stmt.free();

    // 同时设置 category_id 为主分类（如果还没有的话）
    const row = queryOne('SELECT category_id FROM clips WHERE id=?', [id]);
    if (!row || row.category_id == null) {
      const ustmt = db.prepare('UPDATE clips SET category_id=? WHERE id=?');
      ustmt.bind([categoryId, id]);
      ustmt.step();
      ustmt.free();
    }
  }
  saveToDisk();
  return true;
}

function trimExcessClips(maxCount) {
  // 保留置顶和收藏的记录，从最旧的普通记录开始删
  const total = getCount();
  if (total <= maxCount) return 0;

  const toDelete = total - maxCount;
  // 先取出将被删除的记录，同步清理其图片文件，再删除行
  const doomed = queryAll(
    'SELECT id, image_path FROM clips WHERE deleted=0 AND pinned=0 AND favorite=0 ORDER BY created_at ASC LIMIT ?',
    [toDelete]
  );
  for (const row of doomed) {
    if (row.image_path) safeUnlinkImage(row.image_path);
    db.run('DELETE FROM clips WHERE id=?', [row.id]);
  }
  saveToDisk();
  return doomed.length;
}

function getCount() {
  const row = queryOne('SELECT COUNT(*) as count FROM clips WHERE deleted=0');
  return row ? row.count : 0;
}

function getImagesDir() {
  ensureDirectories();
  return IMAGES_DIR;
}

module.exports = {
  DATA_DIR, initDB, getDB, saveToDisk, ensureDirectories,
  addTextClip, addImageClip, addFileClip, getClips, searchClips,
  togglePin, toggleFavorite, deleteClip,
  cleanExpired, purgeDeleted, trimExcessClips, getCount, getImagesDir,
  getCategories, createCategory, renameCategory, deleteCategory,
  setClipCategory, removeClipCategory, batchSetClipCategory,
  isImagePathSafe
};
