const express = require('express'); // sirve para importar Express en tu archivo.

const cors = require('cors'); // Sin esto, el navegador bloquearía las peticiones del frontend.

require('dotenv').config(); // Carga las variables de entorno (.env).

// Importa todos los módulos de rutas.

const authRoutes = require('./routes/authRoutes');

const vehiculoRoutes = require('./routes/vehiculoRoutes');


// const reporteRoutes = require('./routes/reporteRoutes');

const historialRoutes = require('./routes/historialRoutes');

const empleadoRoutes = require('./routes/empleadoRoutes');

const app = express(); // Crea la instancia de la aplicación.

// Middlewares

app.use(cors()); // habilita CORS para TODAS las rutas.

app.use(express.json()); // parsea el body de las peticiones con Content-Type JSON.

// Rutas

// POST /api/auth/login → authRoutes

app.use('/api/auth', authRoutes);

// Rutas de vehículos
app.use('/api/vehiculos', vehiculoRoutes);

// app.use('/api/tarifas', tarifaRoutes);

// app.use('/api/reportes', reporteRoutes);

app.use('/api/historial', historialRoutes);

app.use('/api/empleados', empleadoRoutes);

// Ruta de prueba

app.get('/api/health', (req, res) => {

    res.json({
        status: 'OK',
        timestamp: new Date()
    });

}); // Endpoint público para verificar que el servidor está vivo.

// Manejo de errores global

app.use((err, req, res, next) => {

    console.error(err.stack);

    res.status(500).json({
        error: 'Error interno del servidor.'
    });

});

// Exporta la app para que server.js la use.

module.exports = app;