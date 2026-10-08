const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// Arquivos JSON utilizados
const dbPath = path.join(__dirname, "../db/reservasDB.json");
const usuariosPath = path.join(__dirname, "../db/usuariosDB.json");
const salasPath = path.join(__dirname, "../db/salasDB.json");
const disponibilidadePath = path.join(__dirname, "../db/disponibilidadeDB.json");

const STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
};

// Funções auxiliares de leitura/escrita

// Lê qualquer arquivo JSON; se estiver vazio ou inválido, devolve []
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

// Acesso aos dados dos outros módulos (só leitura).

function findUserById(id) {
  return readFile(usuariosPath).find((u) => u.id === id);
}

function findSalaById(id) {
  return readFile(salasPath).find((s) => s.id === id);
}

function findDisponibilidadesBySala(salaId) {
  return readFile(disponibilidadePath).filter((d) => d.space_id === salaId);
}

// Usuário "externo" = cliente (role CLIENT).
function isExternal(user) {
  return user.role === "CLIENT";
}

// Funções auxiliares de regra de negócio

// "HH:MM" (ou "HH:MM:SS") -> minutos desde 00:00
function timeToMinutes(time) {
  const [h, m] = String(time).split(":");
  return Number(h) * 60 + Number(m || 0);
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Confere se o horário cabe em alguma regra de disponibilidade da sala.
// Se a sala não tiver nenhuma regra cadastrada, não bloqueia.
function dentroDaDisponibilidade(user, spaceId, start, end) {
  const regras = findDisponibilidadesBySala(spaceId);

  if (regras.length === 0) return true;

  const diaSemana = start.getDay(); // 0 (domingo) a 6 (sábado)
  const inicioMin = start.getHours() * 60 + start.getMinutes();
  const fimMin = end.getHours() * 60 + end.getMinutes();

  return regras.some(
    (r) =>
      Number(r.day_of_week) === diaSemana &&
      inicioMin >= timeToMinutes(r.start_time) &&
      fimMin <= timeToMinutes(r.end_time) &&
      (!isExternal(user) || r.is_external_allowed === true),
  );
}

// Duas reservas se sobrepõem se: inicioA < fimB E fimA > inicioB.
// Reservas coladas (uma termina quando a outra começa) NÃO são conflito.
function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

// Procura uma reserva APPROVED no mesmo espaço que se sobreponha ao intervalo.
// ignoreId evita que a reserva conflite com ela mesma ao ser aprovada.
function findConflict(reservas, spaceId, start, end, ignoreId) {
  return reservas.find(
    (r) =>
      r.id !== ignoreId &&
      r.space_id === spaceId &&
      r.status === STATUS.APPROVED &&
      overlaps(start, end, new Date(r.start_datetime), new Date(r.end_datetime)),
  );
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Reserva:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: ID gerado automaticamente (UUID)
 *         space_id:
 *           type: string
 *           description: ID da sala/espaço reservado
 *         user_id:
 *           type: string
 *           description: ID do usuário que solicitou
 *         start_datetime:
 *           type: string
 *           format: date-time
 *         end_datetime:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *         rejection_reason:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "9f1c2b7e-5d3a-4e8f-a1b2-0c3d4e5f6a7b"
 *         space_id: "a1b2c3d4-1111-4222-8333-444455556666"
 *         user_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *         start_datetime: "2026-10-12T14:00:00"
 *         end_datetime: "2026-10-12T16:00:00"
 *         status: "PENDING"
 *         rejection_reason: null
 *         created_at: "2026-10-06T12:00:00.000Z"
 *
 *     ReservaInput:
 *       type: object
 *       required:
 *         - space_id
 *         - user_id
 *         - start_datetime
 *         - end_datetime
 *       properties:
 *         space_id:
 *           type: string
 *         user_id:
 *           type: string
 *         start_datetime:
 *           type: string
 *           format: date-time
 *         end_datetime:
 *           type: string
 *           format: date-time
 *       example:
 *         space_id: "a1b2c3d4-1111-4222-8333-444455556666"
 *         user_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *         start_datetime: "2026-10-12T14:00:00"
 *         end_datetime: "2026-10-12T16:00:00"
 *
 *     ReservaUpdateInput:
 *       type: object
 *       description: Todos os campos são opcionais; o que não for enviado continua como estava.
 *       properties:
 *         space_id:
 *           type: string
 *         start_datetime:
 *           type: string
 *           format: date-time
 *         end_datetime:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *         rejection_reason:
 *           type: string
 *           description: Obrigatório quando o status for REJECTED
 *       example:
 *         status: "APPROVED"
 */

/**
 * @swagger
 * tags:
 *   name: Reservas
 *   description: API de registro de solicitações e reservas (bookings)
 */

/**
 * @swagger
 * /reservas:
 *   get:
 *     summary: Retorna a lista de reservas
 *     tags: [Reservas]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, CANCELLED]
 *         description: Filtrar por status
 *       - in: query
 *         name: space_id
 *         schema:
 *           type: string
 *         description: Filtrar por sala
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filtrar por usuário
 *     responses:
 *       200:
 *         description: Lista de reservas obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Reserva'
 */
router.get("/", (req, res) => {
  let reservas = readData();
  const { status, space_id, user_id } = req.query;

  if (status) {
    reservas = reservas.filter((r) => r.status === status.toUpperCase());
  }

  if (space_id) {
    reservas = reservas.filter((r) => r.space_id === space_id);
  }

  if (user_id) {
    reservas = reservas.filter((r) => r.user_id === user_id);
  }

  res.json(reservas);
});

/**
 * @swagger
 * /reservas/{id}:
 *   get:
 *     summary: Busca uma reserva pelo ID
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da reserva
 *     responses:
 *       200:
 *         description: Reserva encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reserva'
 *       404:
 *         description: Reserva não encontrada
 */
router.get("/:id", (req, res) => {
  const reserva = readData().find((r) => r.id === req.params.id);

  if (!reserva) {
    return res.status(404).json({ message: "Reserva não encontrada" });
  }

  res.json(reserva);
});

/**
 * @swagger
 * /reservas:
 *   post:
 *     summary: Cria uma solicitação de reserva (nasce como PENDING)
 *     tags: [Reservas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservaInput'
 *     responses:
 *       201:
 *         description: Solicitação criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: Dados inválidos, sala inativa ou fora da disponibilidade
 *       404:
 *         description: Usuário ou sala não encontrados
 *       409:
 *         description: Já existe uma reserva aprovada nesse horário
 */
router.post("/", (req, res) => {
  const { space_id, user_id, start_datetime, end_datetime } = req.body;

  // 1. Campos obrigatórios
  if (!space_id || !user_id || !start_datetime || !end_datetime) {
    return res.status(400).json({
      message:
        "Os campos space_id, user_id, start_datetime e end_datetime são obrigatórios.",
    });
  }

  // 2. Datas válidas
  const start = new Date(start_datetime);
  const end = new Date(end_datetime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      message: "Datas inválidas. Use o formato ISO, ex: 2026-10-12T14:00:00.",
    });
  }

  if (start >= end) {
    return res.status(400).json({
      message: "start_datetime deve ser anterior a end_datetime.",
    });
  }

  if (start < new Date()) {
    return res.status(400).json({
      message: "Não é possível reservar em uma data/hora que já passou.",
    });
  }

  // A reserva precisa começar e terminar no mesmo dia
  if (!sameDay(start, end)) {
    return res.status(400).json({
      message: "A reserva deve começar e terminar no mesmo dia.",
    });
  }

  // 3. Usuário e sala existem
  const user = findUserById(user_id);
  if (!user) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  const sala = findSalaById(space_id);
  if (!sala) {
    return res.status(404).json({ message: "Sala não encontrada" });
  }

  // 4. Sala ativa
  if (!sala.is_active) {
    return res.status(400).json({ message: "Esta sala não está ativa." });
  }

  // 5. Disponibilidade semanal (só valida se a sala tiver regras cadastradas)
  if (!dentroDaDisponibilidade(user, space_id, start, end)) {
    return res.status(400).json({
      message:
        "Horário fora da disponibilidade da sala (ou não permitido para usuários externos).",
    });
  }

  // 6. Conflito com reserva já aprovada
  const reservas = readData();

  if (findConflict(reservas, space_id, start, end)) {
    return res.status(409).json({
      message: "Já existe uma reserva aprovada para esta sala nesse horário.",
    });
  }

  const novaReserva = {
    id: uuidv4(),
    space_id,
    user_id,
    start_datetime,
    end_datetime,
    status: STATUS.PENDING,
    rejection_reason: null,
    created_at: new Date().toISOString(),
  };

  reservas.push(novaReserva);
  saveData(reservas);

  res.status(201).json(novaReserva);
});

/**
 * @swagger
 * /reservas/{id}:
 *   put:
 *     summary: Atualiza uma reserva existente (dados e/ou status)
 *     description: >
 *       Permite alterar sala, horário e status da reserva. Para aprovar,
 *       rejeitar ou cancelar, envie o novo status. Reservas REJECTED ou
 *       CANCELLED não podem mais ser alteradas.
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da reserva
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReservaUpdateInput'
 *     responses:
 *       200:
 *         description: Reserva atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Reserva'
 *       400:
 *         description: Dados inválidos, sala inativa, fora da disponibilidade ou rejection_reason ausente
 *       404:
 *         description: Reserva ou sala não encontrada
 *       409:
 *         description: Transição de status inválida, reserva já finalizada ou conflito de horário
 */
router.put("/:id", (req, res) => {
  const reservas = readData();
  const index = reservas.findIndex((r) => r.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Reserva não encontrada" });
  }

  const atual = reservas[index];

  // Reservas rejeitadas ou canceladas não podem mais ser alteradas
  if (atual.status === STATUS.REJECTED || atual.status === STATUS.CANCELLED) {
    return res.status(409).json({
      message: `Não é possível alterar uma reserva ${atual.status}.`,
    });
  }

  const { space_id, start_datetime, end_datetime, status, rejection_reason } =
    req.body;

  // Status: valida o valor e a transição (PENDING -> qualquer; APPROVED -> APPROVED ou CANCELLED)
  const novoStatus =
    status !== undefined ? String(status).toUpperCase() : atual.status;

  if (!Object.values(STATUS).includes(novoStatus)) {
    return res.status(400).json({
      message: "Status inválido. Use PENDING, APPROVED, REJECTED ou CANCELLED.",
    });
  }

  if (
    atual.status === STATUS.APPROVED &&
    novoStatus !== STATUS.APPROVED &&
    novoStatus !== STATUS.CANCELLED
  ) {
    return res.status(409).json({
      message: "Uma reserva APPROVED só pode continuar APPROVED ou ser CANCELLED.",
    });
  }

  // Rejeitar exige um motivo
  const motivo =
    rejection_reason !== undefined ? String(rejection_reason).trim() : "";

  if (novoStatus === STATUS.REJECTED && !motivo) {
    return res.status(400).json({
      message: "O campo rejection_reason é obrigatório ao rejeitar.",
    });
  }

  // Dados da reserva (o que não vier no body continua como estava)
  const novoSpaceId = space_id || atual.space_id;
  const novoInicio = start_datetime || atual.start_datetime;
  const novoFim = end_datetime || atual.end_datetime;

  const start = new Date(novoInicio);
  const end = new Date(novoFim);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      message: "Datas inválidas. Use o formato ISO, ex: 2026-10-12T14:00:00.",
    });
  }

  if (start >= end) {
    return res.status(400).json({
      message: "start_datetime deve ser anterior a end_datetime.",
    });
  }

  // Só barra datas passadas se o horário foi realmente alterado
  const horarioMudou =
    start.getTime() !== new Date(atual.start_datetime).getTime() ||
    end.getTime() !== new Date(atual.end_datetime).getTime();

  if (horarioMudou && start < new Date()) {
    return res.status(400).json({
      message: "Não é possível reservar em uma data/hora que já passou.",
    });
  }

  if (!sameDay(start, end)) {
    return res.status(400).json({
      message: "A reserva deve começar e terminar no mesmo dia.",
    });
  }

  const sala = findSalaById(novoSpaceId);
  if (!sala) {
    return res.status(404).json({ message: "Sala não encontrada" });
  }

  // Reservas que continuam ativas (PENDING/APPROVED) passam por todas as regras
  if (novoStatus === STATUS.PENDING || novoStatus === STATUS.APPROVED) {
    if (!sala.is_active) {
      return res.status(400).json({ message: "Esta sala não está ativa." });
    }

    const user = findUserById(atual.user_id);
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    if (!dentroDaDisponibilidade(user, novoSpaceId, start, end)) {
      return res.status(400).json({
        message:
          "Horário fora da disponibilidade da sala (ou não permitido para usuários externos).",
      });
    }

    // ignora a própria reserva na checagem de conflito
    if (findConflict(reservas, novoSpaceId, start, end, atual.id)) {
      return res.status(409).json({
        message: "Já existe uma reserva aprovada para esta sala nesse horário.",
      });
    }
  }

  const reservaAtualizada = {
    ...atual,
    space_id: novoSpaceId,
    start_datetime: novoInicio,
    end_datetime: novoFim,
    status: novoStatus,
    rejection_reason: novoStatus === STATUS.REJECTED ? motivo : null,

    // Não permite alterar o ID, o dono nem a data de criação
    id: atual.id,
    user_id: atual.user_id,
    created_at: atual.created_at,
  };

  reservas[index] = reservaAtualizada;
  saveData(reservas);

  res.json(reservaAtualizada);
});

/**
 * @swagger
 * /reservas/{id}:
 *   delete:
 *     summary: Remove uma reserva
 *     tags: [Reservas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da reserva
 *     responses:
 *       200:
 *         description: Reserva removida com sucesso
 *       404:
 *         description: Reserva não encontrada
 */
router.delete("/:id", (req, res) => {
  const reservas = readData();
  const index = reservas.findIndex((r) => r.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Reserva não encontrada" });
  }

  const reservaRemovida = reservas.splice(index, 1);
  saveData(reservas);

  res.json({
    message: "Reserva removida com sucesso",
    reserva: reservaRemovida[0],
  });
});

module.exports = router;