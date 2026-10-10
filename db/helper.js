const { Pool } = require('pg');

class DbHelper {
  constructor(pool) {
    this.pool = pool;
  }

  // Convert ? to $1, $2, etc.
  _convertSql(sql) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  /** Run a query and return all matching rows as objects */
  async all(sql, params = []) {
    try {
      const convertedSql = this._convertSql(sql);
      const res = await this.pool.query(convertedSql, params);
      return res.rows;
    } catch (err) {
      console.error('DB all() error:', err.message, sql);
      throw err;
    }
  }

  /** Run a query and return the first matching row as an object, or null */
  async get(sql, params = []) {
    try {
      const convertedSql = this._convertSql(sql);
      const res = await this.pool.query(convertedSql, params);
      return res.rows.length > 0 ? res.rows[0] : null;
    } catch (err) {
      console.error('DB get() error:', err.message, sql);
      throw err;
    }
  }

  /** Run a statement (INSERT/UPDATE/DELETE) and return { lastInsertRowid, changes } */
  async run(sql, params = []) {
    try {
      let convertedSql = this._convertSql(sql);
      
      // pg requires RETURNING id for last insert row id
      const isInsert = convertedSql.trim().toUpperCase().startsWith('INSERT');
      if (isInsert && !convertedSql.toUpperCase().includes('RETURNING')) {
        convertedSql += ' RETURNING id';
      }

      // convert undefined to null as pg requires
      const safeParams = params.map(v => v === undefined ? null : v);
      
      const res = await this.pool.query(convertedSql, safeParams);
      
      let lastInsertRowid = null;
      if (isInsert && res.rows.length > 0) {
        lastInsertRowid = res.rows[0].id;
      }

      return {
        lastInsertRowid,
        changes: res.rowCount
      };
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error('DB run() error:', err.message, sql);
      }
      throw err;
    }
  }
}

module.exports = DbHelper;
