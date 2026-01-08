// shared/db/sqlPool.ts
import sql from 'mssql';
let pool = null;
function getConfig() {
    const { AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD } = process.env;
    if (!AZURE_SQL_SERVER || !AZURE_SQL_DATABASE || !AZURE_SQL_USER || !AZURE_SQL_PASSWORD) {
        throw new Error('Azure SQL environment variables are missing');
    }
    return {
        server: AZURE_SQL_SERVER,
        database: AZURE_SQL_DATABASE,
        user: AZURE_SQL_USER,
        password: AZURE_SQL_PASSWORD,
        options: {
            encrypt: true,
            trustServerCertificate: false
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        connectionTimeout: 15000,
        requestTimeout: 15000
    };
}
export async function getSQLPool() {
    if (pool && pool.connected) {
        return pool;
    }
    pool = await new sql.ConnectionPool(getConfig()).connect();
    pool.on('error', err => {
        console.error('SQL Pool Error', err);
        pool = null;
    });
    return pool;
}
//# sourceMappingURL=sqlPool.js.map