const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// Arquivo JSON utilizado para armazenar os usuários
const dbPath = path.join(__dirname, "../db/usuariosDB.json");

// Roles permitidas para os usuários
const rolesValidas = ["ADMIN", "CLIENT", "RECEPTION"];

// Função auxiliar para ler o arquivo usuariosDB.json
function readData() {
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Função auxiliar para salvar no arquivo usuariosDB.json
function saveData(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - role
 *       properties:
 *         id:
 *           type: string
 *           description: ID gerado automaticamente (UUID)
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         password_hash:
 *           type: string
 *         role:
 *           type: string
 *           enum: [ADMIN, CLIENT, RECEPTION]
 *         cpf_cnpj:
 *           type: string
 *         company_id:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "e8d47b19-33a1-4328-98df-8a3d1c4708a2"
 *         name: "Gabriel De Bona"
 *         email: "gabriel@email.com"
 *         password_hash: "hash123"
 *         role: "ADMIN"
 *         cpf_cnpj: "123.456.789-00"
 *         company_id: "1"
 *         created_at: "2026-09-26T03:00:00.000Z"
 *
 *     UserUpdateInput:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         password_hash:
 *           type: string
 *         role:
 *           type: string
 *           enum: [ADMIN, CLIENT, RECEPTION]
 *         cpf_cnpj:
 *           type: string
 *         company_id:
 *           type: string
 *       example:
 *         name: "Gabriel De Bona (Atualizado)"
 *         email: "gabriel.novo@email.com"
 *         password_hash: "novasenha123"
 *         role: "ADMIN"
 *         cpf_cnpj: "123.456.789-00"
 *         company_id: "1"
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API de Controle de Usuarios
 *     **Por GabrieL De Bona Sartor Mazzucco**
 */


/**
 * @swagger
 * /usuarios:
 *   get:
 *     summary: Retorna a lista de usuários
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filtrar por nome
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, CLIENT, RECEPTION]
 *         description: Filtrar por role
 *     responses:
 *       200:
 *         description: Lista de usuários obtida com sucesso
 */
router.get("/", (req, res) => {
  let users = readData();
  const { name, role } = req.query;

  if (name) {
    users = users.filter((u) =>
      u.name.toLowerCase().includes(name.toLowerCase()),
    );
  }

  if (role) {
    users = users.filter((u) => u.role.toUpperCase() === role.toUpperCase());
  }

  res.json(users);
});

/**
 * @swagger
 * /usuarios/{id}:
 *   get:
 *     summary: Busca um usuário pelo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/:id", (req, res) => {
  const users = readData();

  const user = users.find((u) => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({
      message: "Usuário não encontrado",
    });
  }

  res.json(user);
});

/**
 * @swagger
 * /usuarios:
 *   post:
 *     summary: Cria um novo usuário
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password_hash:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, CLIENT, RECEPTION]
 *               cpf_cnpj:
 *                 type: string
 *               company_id:
 *                 type: string
 *             example:
 *               name: "Gabriel De Bona"
 *               email: "gabriel@email.com"
 *               password_hash: "hash123"
 *               role: "ADMIN"
 *               cpf_cnpj: "123.456.789-00"
 *               company_id: "1"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos ou campos obrigatórios ausentes
 */
router.post("/", (req, res) => {
  const users = readData();

  const { name, email, password_hash, role, cpf_cnpj, company_id } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({
      message: "Os campos name, email e role são obrigatórios.",
    });
  }

  if (!rolesValidas.includes(role.toUpperCase())) {
    return res.status(400).json({
      message: "Role inválida. Use ADMIN, CLIENT ou RECEPTION.",
    });
  }

  const newUser = {
    id: uuidv4(),
    name,
    email,
    password_hash: password_hash || "",
    role: role.toUpperCase(),
    cpf_cnpj: cpf_cnpj || null,
    company_id: company_id || null,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);

  saveData(users);

  res.status(201).json(newUser);
});

/**
 * @swagger
 * /usuarios/{id}:
 *   put:
 *     summary: Atualiza um usuário existente
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateInput'
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Usuário não encontrado
 */
router.put("/:id", (req, res) => {
  const users = readData();

  const index = users.findIndex((u) => u.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      message: "Usuário não encontrado",
    });
  }

  if (req.body.role && !rolesValidas.includes(req.body.role.toUpperCase())) {
    return res.status(400).json({
      message: "Role inválida. Use ADMIN, CLIENT ou RECEPTION.",
    });
  }

  const updatedUser = {
    ...users[index],
    ...req.body,

    role: req.body.role ? req.body.role.toUpperCase() : users[index].role,

    // Não permite alterar o ID
    id: users[index].id,

    // Mantém a data original de criação
    created_at: users[index].created_at,
  };

  users[index] = updatedUser;

  saveData(users);

  res.json(updatedUser);
});

/**
 * @swagger
 * /usuarios/{id}:
 *   delete:
 *     summary: Remove um usuário
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário removido com sucesso
 *       404:
 *         description: Usuário não encontrado
 */
router.delete("/:id", (req, res) => {
  const users = readData();

  const index = users.findIndex((u) => u.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      message: "Usuário não encontrado",
    });
  }

  const deletedUser = users.splice(index, 1);

  saveData(users);

  res.json({
    message: "Usuário removido com sucesso",
    user: deletedUser[0],
  });
});

module.exports = router;
