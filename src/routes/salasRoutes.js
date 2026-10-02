const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const dbPath = path.join(__dirname, "../db/salasDB.json");

const tiposValidos = ["COWORKING", "LAB", "MEETING_ROOM"];

// funções auxiliares
function readData() {
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

function capacidadeValida(capacity) {
  return Number.isInteger(capacity) && capacity > 0;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Sala:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - capacity
 *       properties:
 *         id:
 *           type: string
 *           description: ID gerado automaticamente (UUID)
 *         name:
 *           type: string
 *           description: Nome da sala
 *         type:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *           description: Tipo do espaço
 *         capacity:
 *           type: integer
 *           description: Capacidade de pessoas
 *         description:
 *           type: string
 *           description: Descrição da sala
 *         is_active:
 *           type: boolean
 *           description: Indica se a sala está ativa para reservas
 *       example:
 *         id: "a1b2c3d4-1111-4222-8333-444455556666"
 *         name: "Sala de Reunião 1"
 *         type: "MEETING_ROOM"
 *         capacity: 10
 *         description: "Sala com projetor e ar-condicionado"
 *         is_active: true
 *
 *     SalaInput:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - capacity
 *       properties:
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *         capacity:
 *           type: integer
 *         description:
 *           type: string
 *         is_active:
 *           type: boolean
 *       example:
 *         name: "Laboratório de Informática"
 *         type: "LAB"
 *         capacity: 25
 *         description: "Laboratório com 25 computadores"
 *         is_active: true
 *
 *     SalaUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         type:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *         capacity:
 *           type: integer
 *         description:
 *           type: string
 *         is_active:
 *           type: boolean
 *       example:
 *         name: "Laboratório de Informática (Atualizado)"
 *         capacity: 30
 *         is_active: false
 */

/**
 * @swagger
 * tags:
 *   name: Salas
 *   description: API de controle de salas/espaços (spaces)
 */

/**
 * @swagger
 * /salas:
 *   get:
 *     summary: Retorna a lista de salas
 *     tags: [Salas]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrar por nome (busca parcial)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [COWORKING, LAB, MEETING_ROOM]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por salas ativas/inativas
 *     responses:
 *       200:
 *         description: Lista de salas obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Sala'
 */
router.get("/", (req, res) => {
  let salas = readData();
  const { name, type, is_active } = req.query;

  if (name) {
    salas = salas.filter((s) =>
      s.name.toLowerCase().includes(name.toLowerCase()),
    );
  }

  if (type) {
    salas = salas.filter((s) => s.type === type.toUpperCase());
  }

  if (is_active !== undefined) {
    salas = salas.filter((s) => String(s.is_active) === is_active);
  }

  res.json(salas);
});

/**
 * @swagger
 * /salas/{id}:
 *   get:
 *     summary: Busca uma sala pelo ID
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sala
 *     responses:
 *       200:
 *         description: Sala encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       404:
 *         description: Sala não encontrada
 */
router.get("/:id", (req, res) => {
  const salas = readData();
  const sala = salas.find((s) => s.id === req.params.id);

  if (!sala) {
    return res.status(404).json({ message: "Sala não encontrada" });
  }

  res.json(sala);
});

/**
 * @swagger
 * /salas:
 *   post:
 *     summary: Cria uma nova sala
 *     tags: [Salas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SalaInput'
 *     responses:
 *       201:
 *         description: Sala criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       400:
 *         description: Dados inválidos ou campos obrigatórios ausentes
 */
router.post("/", (req, res) => {
  const salas = readData();
  const { name, type, capacity, description, is_active } = req.body;

  if (!name || !type || capacity === undefined) {
    return res.status(400).json({
      message: "Os campos name, type e capacity são obrigatórios.",
    });
  }

  if (!tiposValidos.includes(String(type).toUpperCase())) {
    return res.status(400).json({
      message: "Tipo inválido. Use COWORKING, LAB ou MEETING_ROOM.",
    });
  }

  if (!capacidadeValida(capacity)) {
    return res.status(400).json({
      message: "A capacidade deve ser um número inteiro maior que zero.",
    });
  }

  const novaSala = {
    id: uuidv4(),
    name,
    type: String(type).toUpperCase(),
    capacity,
    description: description || "",
    is_active: is_active !== undefined ? Boolean(is_active) : true,
  };

  salas.push(novaSala);
  saveData(salas);

  res.status(201).json(novaSala);
});

/**
 * @swagger
 * /salas/{id}:
 *   put:
 *     summary: Atualiza uma sala existente
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sala
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SalaUpdateInput'
 *     responses:
 *       200:
 *         description: Sala atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Sala'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Sala não encontrada
 */
router.put("/:id", (req, res) => {
  const salas = readData();
  const index = salas.findIndex((s) => s.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Sala não encontrada" });
  }

  const { type, capacity } = req.body;

  if (type && !tiposValidos.includes(String(type).toUpperCase())) {
    return res.status(400).json({
      message: "Tipo inválido. Use COWORKING, LAB ou MEETING_ROOM.",
    });
  }

  if (capacity !== undefined && !capacidadeValida(capacity)) {
    return res.status(400).json({
      message: "A capacidade deve ser um número inteiro maior que zero.",
    });
  }

  const salaAtualizada = {
    ...salas[index],
    ...req.body,
    type: type ? String(type).toUpperCase() : salas[index].type,

    id: salas[index].id,
  };

  salas[index] = salaAtualizada;
  saveData(salas);

  res.json(salaAtualizada);
});

/**
 * @swagger
 * /salas/{id}:
 *   delete:
 *     summary: Remove uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da sala
 *     responses:
 *       200:
 *         description: Sala removida com sucesso
 *       404:
 *         description: Sala não encontrada
 */
router.delete("/:id", (req, res) => {
  const salas = readData();
  const index = salas.findIndex((s) => s.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Sala não encontrada" });
  }

  const salaRemovida = salas.splice(index, 1);
  saveData(salas);

  res.json({
    message: "Sala removida com sucesso",
    sala: salaRemovida[0],
  });
});

module.exports = router;