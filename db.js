const pg = require("pg");
const fs = require("fs");

require("dotenv").config();

const isLive = process.env.DB_MODE === "PRODUCTION";
console.log(`Database mode: ${process.env.DB_MODE}`);
console.log(`Using ${isLive ? 'PRODUCTION' : 'SANDBOX/LOCAL'} database configuration.`);

const config = isLive ? 
    {
        user: process.env.PROD_DB_USER,
        host: `/cloudsql/${process.env.PROD_INSTANCE_CONNECTION_NAME}`,
        database: process.env.PROD_DB_NAME,
        password: process.env.PROD_DB_PASSWORD,
        port: Number(process.env.PROD_DB_PORT || 5432),
        ssl: false
    } : 
    {
        user: process.env.PGUSER,
        host: process.env.PGHOST,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: Number(process.env.PGPORT || 5432),
        ssl: {
            require: true,
        }
    };

const pool = new pg.Pool(config);
pool.connect((err, client, release) => {
    if (err) {
        console.error("Database connection error:", err.stack);
        return;
    }

    client.query("SELECT VERSION()", (err, result) => {
        release(); 

        if (err) {
            console.error("Query error:", err.stack);
            return;
        }

        console.log("Connected to:", result.rows[0].version);
    });
});

module.exports = pool;
