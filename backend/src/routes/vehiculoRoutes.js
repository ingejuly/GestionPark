const express = require('express');
const router = express.Router();

// 1. Asegúrate de usar las mayúsculas/minúsculas exactas del nombre del archivo en tu explorador
const vehiculoController = require('../controllers/vehiculoController.');
const authMiddleware = require('../middleware/auth');

// Middleware para proteger todas las rutas de vehículos
router.use(authMiddleware);

// Rutas
router.post('/entrada', vehiculoController.registrarEntrada);
router.get('/dentro', vehiculoController.getVehiculosDentro);
router.get('/espacios-disponibles', vehiculoController.getEspaciosDisponibles);
router.put('/salida/:id_registro', vehiculoController.registrarSalida);

module.exports = router;