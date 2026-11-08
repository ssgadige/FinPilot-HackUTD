import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import { found } from '../errors';
export type Row = Record<string, any>;
export const LIABILITIES = new Set(['credit_card', 'auto_loan', 'mortgage']);
// This predicate scopes BOTH ends of the join. Never query finance data by object ID alone.
export const VISIBLE = `EXISTS (SELECT 1 FROM connection_accounts ca JOIN connections c
 ON c.id=ca.connection_id AND c.user_id=ca.user_id WHERE ca.account_id=a.id
 AND ca.user_id=a.user_id AND c.user_id=? AND c.status='active')`;
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    chmodSync(path, 0o600);
    this.migrate();
  }
  all<T extends Row = Row>(sql: string, ...args: SQLInputValue[]): T[] { return this.db.prepare(sql).all(...args) as T[]; }
  one<T extends Row = Row>(sql: string, ...args: SQLInputValue[]): T | undefined { return this.db.prepare(sql).get(...args) as T | undefined; }
  exec(sql: string, ...args: SQLInputValue[]) { return this.db.prepare(sql).run(...args); }
  atomic<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private migrate() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS backend_migrations(version INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS request_keys(user_id TEXT NOT NULL REFERENCES users(id), scope TEXT NOT NULL,
      key TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(user_id,scope,key));
      CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS plan_acceptances(user_id TEXT NOT NULL REFERENCES users(id), key TEXT NOT NULL,
      plan_id TEXT NOT NULL, expected_version INTEGER NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(user_id,key));
      CREATE TABLE IF NOT EXISTS run_state(run_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,context_json TEXT NOT NULL,
      request_json TEXT NOT NULL,result_json TEXT,model_calls INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(run_id,user_id) REFERENCES runs(id,user_id));
      CREATE TABLE IF NOT EXISTS agent_records(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,user_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,FOREIGN KEY(run_id,user_id) REFERENCES runs(id,user_id));`);
    if (!this.one('SELECT version FROM backend_migrations WHERE version=1')) this.atomic(() => {
      this.db.exec('ALTER TABLE sessions ADD COLUMN csrf_hash TEXT; ALTER TABLE goals ADD COLUMN version INTEGER NOT NULL DEFAULT 1; ALTER TABLE runs ADD COLUMN error_code TEXT;');
      this.exec('INSERT INTO backend_migrations VALUES(1)');
    });
  }
  user(id: string) { return found(this.one('SELECT id,name,email,snapshot_version FROM users WHERE id=?', id)); }
  accounts(uid: string) { return this.all(`SELECT a.*, 'fixture' AS source_mode FROM accounts a WHERE a.user_id=? AND ${VISIBLE} ORDER BY a.id`, uid, uid); }
  account(uid: string, id: string) { return found(this.accounts(uid).find(a => a.id === id)); }
  scoped(table: 'scheduled_items' | 'subscriptions' | 'transactions', uid: string) {
    return this.all(`SELECT t.* FROM ${table} t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.user_id=? AND ${VISIBLE}`, uid, uid);
  }
  invalidate(uid: string) {
    this.exec('UPDATE users SET snapshot_version=snapshot_version+1 WHERE id=?', uid);
    this.exec("UPDATE plans SET status='stale' WHERE user_id=? AND status='proposed'", uid);
  }
  evidence(uid: string, id: string): Row & {snapshot_version:number} {
    const e = found(this.one('SELECT * FROM evidence WHERE id=? AND user_id=?', id, uid));
    const run = found(this.one('SELECT snapshot_version FROM runs WHERE id=? AND user_id=?', e.run_id, uid));
    if (run.snapshot_version !== this.user(uid).snapshot_version) return found<Row & {snapshot_version:number}>(undefined);
    const state=this.one('SELECT context_json FROM run_state WHERE run_id=? AND user_id=?',e.run_id,uid);
    if(state){
      const context=JSON.parse(state.context_json) as {allowedAccountIds:string[]};
      const visible=new Set(this.accounts(uid).map(a=>a.id));
      if(context.allowedAccountIds.some(id=>!visible.has(id)))return found<Row & {snapshot_version:number}>(undefined);
    }
    if (e.kind === 'account') this.account(uid, e.source_id);
    if (e.kind === 'transaction') found(this.scoped('transactions', uid).find(t => t.id === e.source_id));
    return {...e,snapshot_version:run.snapshot_version};
  }
  close() { this.db.close(); }
}
