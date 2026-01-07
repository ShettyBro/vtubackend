import sql from "mssql";
import env from "./env.js";
import logger from "./logger.js";

let pool = null;

export async function getPool() {
  if (pool) return pool;

  if (!env.db.server) {
    throw new Error("Database not configured");
  }

  pool = await sql.connect({
    user: env.db.user,
    password: env.db.password,
    server: env.db.server,
    database: env.db.database,
    options: {
      encrypt: true,
      trustServerCertificate: false
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000
    }
  });

  logger.info("DB connection established");
  return pool;
}

export { sql };
