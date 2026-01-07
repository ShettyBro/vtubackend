import sql from "mssql";
import env from "./env.js";
import logger from "./logger.js";

const pool = new sql.ConnectionPool({
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

const poolPromise = pool
  .connect()
  .then((p) => {
    logger.info("DB connection established");
    return p;
  })
  .catch((err) => {
    logger.error("DB connection failed", { error: err.message });
    throw err;
  });

export { sql, poolPromise };
