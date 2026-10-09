const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

const dbPath = path.join(__dirname, "../db/disponibilidadeDB.json");
const salasPath = path.join(__dirname, "../db/salasDB.json");

const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function readFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    if (!data.trim()) return [];
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

function readData() {
  return readFile(dbPath);
}

function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

function findSalaById(id) {
  return readFile(salasPath).find((s) => s.id === id);
}

function timeToMinutes(time) {
  const [h, m] = String(time).split(":");
  return Number(h) * 60 + Number(m || 0);
}

function parseDia(value) {
  const dia =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;

  return Number.isInteger(dia) && dia >= 0 && dia <= 6 ? dia : null;
}

function validarJanela({
  day_of_week,
  start_time,
  end_time,
  is_external_allowed,
}) {
  const dia = parseDia(day_of_week);

  if (dia === null) {
    return {
      erro: "day_of_week deve ser um número inteiro de 0 (domingo) a 6 (sábado).",
    };
  }

  if (
    !HORA_REGEX.test(String(start_time)) ||
    !HORA_REGEX.test(String(end_time))
  ) {
    return {
      erro: "start_time e end_time devem estar no formato HH:MM (ex: 08:00).",
    };
  }

  if (timeToMinutes(start_time) >= timeToMinutes(end_time)) {
    return {
      erro: "start_time deve ser anterior a end_time.",
    };
  }

  if (typeof is_external_allowed !== "boolean") {
    return {
      erro: "is_external_allowed deve ser true ou false.",
    };
  }

  return {
    dados: {
      day_of_week: dia,
      start_time,
      end_time,
      is_external_allowed,
    },
  };
}

function findConflict(
  disponibilidades,
  space_id,
  day_of_week,
  start_time,
  end_time,
  ignoreId,
) {
  const inicio = timeToMinutes(start_time);
  const fim = timeToMinutes(end_time);

  return disponibilidades.find(
    (d) =>
      d.id !== ignoreId &&
      d.space_id === space_id &&
      Number(d.day_of_week) === day_of_week &&
      inicio < timeToMinutes(d.end_time) &&
      fim > timeToMinutes(d.start_time),
  );
}

// ============================================
// DOCUMENTAÇÃO SWAGGER - SCHEMAS
// ============================================

/**
 * @swagger
 * tags:
 *   - name: Disponibilidades
 *     description: Gerenciamento de disponibilidades dos espaços
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Disponibilidade:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Identificador único da disponibilidade
 *         space_id:
 *           type: string
 *           description: Identificador da sala
 *         day_of_week:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: Dia da semana (0 domingo, 6 sábado)
 *         start_time:
 *           type: string
 *           description: Horário de início no formato HH:MM
 *           example: "08:00"
 *         end_time:
 *           type: string
 *           description: Horário de término no formato HH:MM
 *           example: "12:00"
 *         is_external_allowed:
 *           type: boolean
 *           description: Indica se usuários externos são permitidos
 *
 *     DisponibilidadeInput:
 *       type: object
 *       required:
 *         - space_id
 *         - day_of_week
 *         - start_time
 *         - end_time
 *       properties:
 *         space_id:
 *           type: string
 *           description: ID de uma sala cadastrada
 *           example: "a1b2c3d4-1111-4222-8333-444455556666"
 *         day_of_week:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: Dia da semana
 *           example: 1
 *         start_time:
 *           type: string
 *           example: "08:00"
 *         end_time:
 *           type: string
 *           example: "12:00"
 *         is_external_allowed:
 *           type: boolean
 *           default: true
 *           example: true
 *
 *     DisponibilidadeUpdate:
 *       type: object
 *       properties:
 *         day_of_week:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           example: 2
 *         start_time:
 *           type: string
 *           example: "09:00"
 *         end_time:
 *           type: string
 *           example: "13:00"
 *         is_external_allowed:
 *           type: boolean
 *           example: false
 */

// ============================================
// GET - LISTAR DISPONIBILIDADES
// ============================================

/**
 * @swagger
 * /disponibilidades:
 *   get:
 *     summary: Listar todas as disponibilidades
 *     description: Retorna disponibilidades, permitindo filtros por sala, dia e permissão externa.
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: query
 *         name: space_id
 *         schema:
 *           type: string
 *         description: Filtrar pelo ID da sala
 *       - in: query
 *         name: day_of_week
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         description: Filtrar pelo dia da semana
 *       - in: query
 *         name: is_external_allowed
 *         schema:
 *           type: boolean
 *         description: Filtrar pela permissão de usuários externos
 *     responses:
 *       200:
 *         description: Lista de disponibilidades retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Disponibilidade'
 */

router.get("/", (req, res) => {
  let disponibilidades = readData();

  const { space_id, day_of_week, is_external_allowed } = req.query;

  if (space_id) {
    disponibilidades = disponibilidades.filter((d) => d.space_id === space_id);
  }

  if (day_of_week !== undefined) {
    disponibilidades = disponibilidades.filter(
      (d) => String(d.day_of_week) === String(day_of_week),
    );
  }

  if (is_external_allowed !== undefined) {
    disponibilidades = disponibilidades.filter(
      (d) => String(d.is_external_allowed) === is_external_allowed,
    );
  }

  res.json(disponibilidades);
});

// ============================================
// GET - BUSCAR POR ID
// ============================================

/**
 * @swagger
 * /disponibilidades/{id}:
 *   get:
 *     summary: Buscar disponibilidade por ID
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da disponibilidade
 *     responses:
 *       200:
 *         description: Disponibilidade encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       404:
 *         description: Disponibilidade não encontrada
 */

router.get("/:id", (req, res) => {
  const disponibilidade = readData().find((d) => d.id === req.params.id);

  if (!disponibilidade) {
    return res.status(404).json({
      message: "Disponibilidade não encontrada",
    });
  }

  res.json(disponibilidade);
});

// ============================================
// POST - CADASTRAR DISPONIBILIDADE
// ============================================

/**
 * @swagger
 * /disponibilidades:
 *   post:
 *     summary: Cadastrar nova disponibilidade
 *     description: Cadastra uma janela de disponibilidade para uma sala.
 *     tags: [Disponibilidades]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisponibilidadeInput'
 *     responses:
 *       201:
 *         description: Disponibilidade cadastrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       400:
 *         description: Dados inválidos ou obrigatórios ausentes
 *       404:
 *         description: Sala não encontrada
 *       409:
 *         description: Conflito com horário já cadastrado
 */

router.post("/", (req, res) => {
  const { space_id, day_of_week, start_time, end_time } = req.body;

  const is_external_allowed =
    req.body.is_external_allowed === undefined
      ? true
      : req.body.is_external_allowed;

  if (!space_id || day_of_week === undefined || !start_time || !end_time) {
    return res.status(400).json({
      message:
        "Os campos space_id, day_of_week, start_time e end_time são obrigatórios.",
    });
  }

  const validacao = validarJanela({
    day_of_week,
    start_time,
    end_time,
    is_external_allowed,
  });

  if (validacao.erro) {
    return res.status(400).json({
      message: validacao.erro,
    });
  }

  if (!findSalaById(space_id)) {
    return res.status(404).json({
      message: "Sala não encontrada",
    });
  }

  const disponibilidades = readData();

  if (
    findConflict(
      disponibilidades,
      space_id,
      validacao.dados.day_of_week,
      start_time,
      end_time,
    )
  ) {
    return res.status(409).json({
      message:
        "Já existe uma janela cadastrada que se sobrepõe a este horário para esta sala e dia.",
    });
  }

  const novaDisponibilidade = {
    id: uuidv4(),
    space_id,
    ...validacao.dados,
  };

  disponibilidades.push(novaDisponibilidade);

  saveData(disponibilidades);

  res.status(201).json(novaDisponibilidade);
});

// ============================================
// PUT - ATUALIZAR DISPONIBILIDADE
// ============================================

/**
 * @swagger
 * /disponibilidades/{id}:
 *   put:
 *     summary: Atualizar disponibilidade
 *     description: Atualiza os horários, dia ou permissão externa de uma disponibilidade.
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da disponibilidade
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisponibilidadeUpdate'
 *     responses:
 *       200:
 *         description: Disponibilidade atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Disponibilidade'
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Disponibilidade não encontrada
 *       409:
 *         description: Conflito de horários
 */

router.put("/:id", (req, res) => {
  const disponibilidades = readData();

  const index = disponibilidades.findIndex((d) => d.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      message: "Disponibilidade não encontrada",
    });
  }

  const atual = disponibilidades[index];

  const { day_of_week, start_time, end_time, is_external_allowed } = req.body;

  const validacao = validarJanela({
    day_of_week: day_of_week !== undefined ? day_of_week : atual.day_of_week,

    start_time: start_time !== undefined ? start_time : atual.start_time,

    end_time: end_time !== undefined ? end_time : atual.end_time,

    is_external_allowed:
      is_external_allowed !== undefined
        ? is_external_allowed
        : atual.is_external_allowed,
  });

  if (validacao.erro) {
    return res.status(400).json({
      message: validacao.erro,
    });
  }

  const { dados } = validacao;

  if (
    findConflict(
      disponibilidades,
      atual.space_id,
      dados.day_of_week,
      dados.start_time,
      dados.end_time,
      atual.id,
    )
  ) {
    return res.status(409).json({
      message:
        "Já existe uma janela cadastrada que se sobrepõe a este horário para esta sala e dia.",
    });
  }

  disponibilidades[index] = {
    id: atual.id,
    space_id: atual.space_id,
    ...dados,
  };

  saveData(disponibilidades);

  res.json(disponibilidades[index]);
});

// ============================================
// DELETE - EXCLUIR DISPONIBILIDADE
// ============================================

/**
 * @swagger
 * /disponibilidades/{id}:
 *   delete:
 *     summary: Excluir disponibilidade
 *     tags: [Disponibilidades]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da disponibilidade
 *     responses:
 *       200:
 *         description: Disponibilidade removida com sucesso
 *       404:
 *         description: Disponibilidade não encontrada
 */

router.delete("/:id", (req, res) => {
  const disponibilidades = readData();

  const index = disponibilidades.findIndex((d) => d.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      message: "Disponibilidade não encontrada",
    });
  }

  const removida = disponibilidades.splice(index, 1);

  saveData(disponibilidades);

  res.json({
    message: "Disponibilidade removida com sucesso",
    disponibilidade: removida[0],
  });
});

module.exports = router;
