/**
 * Helper wrapper around sql.js to provide a simpler API
 * similar to better-sqlite3 for our route files.
 */
class DbHelper {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  /** Run a query and return all matching rows as objects */
  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error('DB all() error:', err.message, sql);
      throw err;
    }
  }

  /** Run a query and return the first matching row as an object, or null */
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      let row = null;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    } catch (err) {
      console.error('DB get() error:', err.message, sql);
      throw err;
    }
  }

  /** Run a statement (INSERT/UPDATE/DELETE) and return { lastInsertRowid, changes } */
  run(sql, params = []) {
    try {
      // sql.js cannot bind undefined — convert to null
      const safeParams = params.map(v => v === undefined ? null : v);
      this.db.run(sql, safeParams);
      const lastId = this.db.exec('SELECT last_insert_rowid() as id');
      const changes = this.db.getRowsModified();
      this.saveFn(); // persist to disk
      return {
        lastInsertRowid: lastId.length > 0 ? lastId[0].values[0][0] : null,
        changes
      };
    } catch (err) {
      console.error('DB run() error:', err.message, sql);
      throw err;
    }
  }
}

module.exports = DbHelper;
