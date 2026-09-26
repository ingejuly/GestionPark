const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smartpark',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error al conectar a MySQL:');
        console.error('Detalle:', err.message);
        return;
    }

    console.log('Conexión a MySQL establecida correctamente.');
    connection.release();
});

module.exports = pool.promise();
