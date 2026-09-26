const db = require('../config/db');

// ======================================================
// REGISTRAR ENTRADA DE VEHÍCULO
// ======================================================
const registrarEntrada = async (req, res) => {
    try {
        const { placa, tipo_vehiculo, id_espacio } = req.body;

        // Validar datos obligatorios
        if (!placa || !tipo_vehiculo || !id_espacio) {
            return res.status(400).json({
                error: 'Placa, tipo de vehículo y espacio son obligatorios.'
            });
        }

        // Validar tipo de vehículo
        if (!['moto', 'carro'].includes(tipo_vehiculo)) {
            return res.status(400).json({
                error: 'El tipo de vehículo debe ser moto o carro.'
            });
        }

        // Verificar que el espacio exista y corresponda al tipo de vehículo
        const [espacios] = await db.query(
            `SELECT *
             FROM espacio
             WHERE id_espacio = ?
             AND tipo_vehiculo = ?
             AND estado = 'disponible'`,
            [id_espacio, tipo_vehiculo]
        );

        if (espacios.length === 0) {
            return res.status(400).json({
                error: 'El espacio no está disponible o no corresponde al tipo de vehículo.'
            });
        }

        // Verificar si la placa ya está dentro del parqueadero
        const [vehiculoDentro] = await db.query(
            `SELECT *
             FROM vehiculo_estacionado
             WHERE placa = ?
             AND hora_salida IS NULL`,
            [placa]
        );

        if (vehiculoDentro.length > 0) {
            return res.status(400).json({
                error: 'Este vehículo ya se encuentra dentro del parqueadero.'
            });
        }

        // Registrar entrada
        const [resultado] = await db.query(
            `INSERT INTO vehiculo_estacionado
            (placa, tipo_vehiculo, id_espacio, id_usuario, hora_entrada)
            VALUES (?, ?, ?, ?, NOW())`,
            [
                placa.toUpperCase(),
                tipo_vehiculo,
                id_espacio,
                req.usuario.id_usuario
            ]
        );

        // Cambiar estado del espacio a ocupado
        await db.query(
            `UPDATE espacio
             SET estado = 'ocupado'
             WHERE id_espacio = ?`,
            [id_espacio]
        );

        res.status(201).json({
            success: true,
            mensaje: 'Entrada registrada correctamente.',
            id_registro: resultado.insertId
        });

    } catch (error) {
        console.error('Error al registrar entrada:', error);

        res.status(500).json({
            error: 'Error al registrar la entrada del vehículo.'
        });
    }
};


// ======================================================
// OBTENER VEHÍCULOS ACTUALMENTE DENTRO
// ======================================================
const getVehiculosDentro = async (req, res) => {
    try {

        const [rows] = await db.query(
            `SELECT
                v.id_registro,
                v.placa,
                v.tipo_vehiculo,
                e.codigo AS espacio,
                v.hora_entrada,
                u.nombre_completo AS empleado
             FROM vehiculo_estacionado v
             INNER JOIN espacio e
                ON v.id_espacio = e.id_espacio
             INNER JOIN usuario u
                ON v.id_usuario = u.id_usuario
             WHERE v.hora_salida IS NULL
             ORDER BY v.hora_entrada DESC`
        );

        res.json(rows);

    } catch (error) {

        console.error('Error al obtener vehículos dentro:', error);

        res.status(500).json({
            error: 'Error al obtener los vehículos dentro del parqueadero.'
        });
    }
};


// ======================================================
// REGISTRAR SALIDA DE VEHÍCULO
// ======================================================
const registrarSalida = async (req, res) => {
    try {

        const { id_registro } = req.params;
        const { metodo_pago } = req.body;

        // Validar método de pago
        if (!['efectivo', 'tarjeta', 'qr'].includes(metodo_pago)) {
            return res.status(400).json({
                error: 'El método de pago debe ser efectivo, tarjeta o qr.'
            });
        }

        // Buscar vehículo
        const [vehiculos] = await db.query(
            `SELECT *
             FROM vehiculo_estacionado
             WHERE id_registro = ?
             AND hora_salida IS NULL`,
            [id_registro]
        );

        if (vehiculos.length === 0) {
            return res.status(404).json({
                error: 'Vehículo no encontrado o ya tiene registrada su salida.'
            });
        }

        const vehiculo = vehiculos[0];

        // Obtener tarifa actual
        const [tarifas] = await db.query(
            `SELECT tarifa_por_hora
             FROM tarifas
             WHERE tipo_vehiculo = ?`,
            [vehiculo.tipo_vehiculo]
        );

        if (tarifas.length === 0) {
            return res.status(400).json({
                error: 'No existe una tarifa configurada para este vehículo.'
            });
        }

        const tarifaHora = Number(tarifas[0].tarifa_por_hora);

        // Calcular tiempo estacionado
        const [tiempo] = await db.query(
            `SELECT
                TIMESTAMPDIFF(
                    MINUTE,
                    hora_entrada,
                    NOW()
                ) AS minutos
             FROM vehiculo_estacionado
             WHERE id_registro = ?`,
            [id_registro]
        );

        let minutos = Number(tiempo[0].minutos);

        // Si estuvo menos de 1 minuto, cobrar mínimo 1 hora
        if (minutos < 1) {
            minutos = 1;
        }

        // Convertir minutos a horas cobrables
        const horas = Math.ceil(minutos / 60);

        // Calcular cobro por hora
        let total = horas * tarifaHora;

        // Tarifa máxima del día para motos
        if (vehiculo.tipo_vehiculo === 'moto' && total > 4000) {
            total = 4000;
        }

        // Actualizar vehículo
        await db.query(
            `UPDATE vehiculo_estacionado
             SET
                hora_salida = NOW(),
                tiempo_estacionado = ?,
                total_pagado = ?
             WHERE id_registro = ?`,
            [
                minutos,
                total,
                id_registro
            ]
        );

        // Liberar espacio
        await db.query(
            `UPDATE espacio
             SET estado = 'disponible'
             WHERE id_espacio = ?`,
            [vehiculo.id_espacio]
        );

        // Registrar pago
        await db.query(
            `INSERT INTO transaccion_pago
            (id_registro, monto, metodo_pago, id_usuario)
            VALUES (?, ?, ?, ?)`,
            [
                id_registro,
                total,
                metodo_pago,
                req.usuario.id_usuario
            ]
        );

        res.json({
            success: true,
            mensaje: 'Salida registrada correctamente.',
            placa: vehiculo.placa,
            minutos_estacionado: minutos,
            horas_cobradas: horas,
            tarifa_por_hora: tarifaHora,
            total_pagado: total,
            metodo_pago: metodo_pago
        });

    } catch (error) {

        console.error('Error al registrar salida:', error);

        res.status(500).json({
            error: 'Error al registrar la salida del vehículo.'
        });
    }
};


// ======================================================
// OBTENER ESPACIOS DISPONIBLES
// ======================================================
const getEspaciosDisponibles = async (req, res) => {
    try {

        const [rows] = await db.query(
            `SELECT
                id_espacio,
                codigo,
                tipo_vehiculo,
                estado
             FROM espacio
             WHERE estado = 'disponible'
             ORDER BY codigo`
        );

        res.json(rows);

    } catch (error) {

        console.error('Error al obtener espacios:', error);

        res.status(500).json({
            error: 'Error al obtener los espacios disponibles.'
        });
    }
};


module.exports = {
    registrarEntrada,
    getVehiculosDentro,
    registrarSalida,
    getEspaciosDisponibles
};