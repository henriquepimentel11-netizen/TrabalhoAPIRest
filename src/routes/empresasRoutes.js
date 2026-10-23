const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'db', 'empresasDB.json')

function lerEmpresasDB() {
  try {
    const conteudo = fs.readFileSync(DB_PATH, 'utf-8')
    if (!conteudo.trim()) return []
    return JSON.parse(conteudo)
  } catch (err) {
    console.error('Erro ao ler empresasDB:', err.message)
    return []
  }
}

function salvarEmpresasDB() {
  fs.writeFileSync(DB_PATH, JSON.stringify(empresasDB, null, 2), 'utf-8')
}

let empresasDB = lerEmpresasDB()

// Remove pontos, barra e traço para comparar CNPJs independente da formatação
function normalizarCNPJ(cnpj) {
  return String(cnpj).replace(/\D/g, '')
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Empresa:
 *       type: object
 *       required:
 *         - ID
 *         - Nome_corporativo
 *         - Nome_Trade
 *         - CNPJ
 *         - telefone
 *         - Data_criacao
 *       properties:
 *         ID:
 *           type: string
 *           format: uuid
 *           description: ID da empresa
 *         Nome_corporativo:
 *           type: string
 *           description: Nome corporativo da empresa
 *         Nome_Trade:
 *           type: string
 *           description: Nome de trade da empresa
 *         CNPJ:
 *           type: string
 *           description: CNPJ da empresa
 *         telefone:
 *           type: string
 *           description: Telefone da empresa
 *         Data_criacao:
 *           type: string
 *           description: Data de criação da empresa
 *       example:
 *         ID: 1
 *         Nome_corporativo: Empresa Exemplo
 *         Nome_Trade: Exemplo
 *         CNPJ: 12.345.678/0001-90
 *         telefone: (11) 1234-5678
 *         Data_criacao: 2023-01-01
 */

/**
 * @swagger
 * tags:
 *   name: Empresas
 *   description: API de Controle de Empresas
 *     **Por José Henrique Pereira Pimentel**
 */

/**
 * @swagger
 * /empresas:
 *   get:
 *     summary: Retorna todas as empresas
 *     tags: [Empresas]
 *     responses:
 *       200:
 *         description: Lista de empresas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 */
// Retornar todas as empresas
router.get('/', (req, res) => {
  console.log("getroute")
  res.json(empresasDB)
})

/**
 * @swagger
 * /empresas/nome/{nome}:
 *   get:
 *     summary: Busca empresas pelo nome
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome corporativo ou Nome Trade (busca parcial)
 *     responses:
 *       200:
 *         description: Lista de empresas encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Nenhuma empresa encontrada
 */
router.get('/nome/:nome', (req, res) => {
  const termo = req.params.nome.toLowerCase()

  const resultado = empresasDB.filter(emp =>
    emp.Nome_corporativo.toLowerCase().includes(termo) ||
    emp.Nome_Trade.toLowerCase().includes(termo)
  )

  if (resultado.length === 0) {
    return res.status(404).json({ message: 'Nenhuma empresa encontrada' })
  }

  res.json(resultado)
})

/**
 * @swagger
 * /empresas/{id}:
 *   get:
 *     summary: Retorna uma empresa pelo ID
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID da empresa
 *     responses:
 *       200:
 *         description: Uma empresa pelo ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       404:
 *         description: Empresa não encontrada
 */
router.get('/:id', (req, res) => {
  const id = req.params.id
  var empresa = empresasDB.find(emp => emp.ID === id)

  if (!empresa) {
    return res.status(404).json({ message: 'Empresa não encontrada' })
  }

  res.json(empresa)
})

/**
 * @swagger
 * /empresas:
 *   post:
 *     summary: Cria uma nova empresa
 *     tags: [Empresas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Empresa'
 *     responses:
 *       200:
 *         description: Empresa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Empresa'
 *       400:
 *         description: Dados da empresa inválidos
 *       409:
 *         description: Já existe uma empresa com este CNPJ
 */
router.post('/', (req, res) => {
  const { Nome_corporativo, Nome_Trade, CNPJ, telefone, Data_criacao } = req.body

  if (!Nome_corporativo || !Nome_Trade || !CNPJ || !telefone || !Data_criacao) {
    return res.status(400).json({ message: 'Dados da empresa inválidos' })
  }

  const cnpjNormalizado = normalizarCNPJ(CNPJ)
  const cnpjExiste = empresasDB.some(
    emp => normalizarCNPJ(emp.CNPJ) === cnpjNormalizado
  )

  if (cnpjExiste) {
    return res.status(409).json({ message: 'Já existe uma empresa com este CNPJ' })
  }

  empresasDB.push({
    ID: uuidv4(),
    Nome_corporativo,
    Nome_Trade,
    CNPJ,
    telefone,
    Data_criacao
  })

  salvarEmpresasDB()
  res.json({ message: 'Empresa criada com sucesso' })
})

/**
 * @swagger
 * /empresas/{id}:
 *   put:
 *     summary: Atualiza uma empresa existente
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Empresa atualizada
 *       400:
 *         description: Dados da empresa inválidos
 *       404:
 *         description: Empresa não encontrada
 *       409:
 *         description: Já existe uma empresa com este CNPJ
 */
router.put('/:id', (req, res) => {
  const id = req.params.id
  const novaEmpresa = req.body

  const empresaAtual = empresasDB.find(emp => emp.ID === id)

  if (!empresaAtual) {
    return res.status(404).json({ message: 'Empresa não encontrada' })
  }

  if (!novaEmpresa.Nome_corporativo || !novaEmpresa.Nome_Trade || !novaEmpresa.CNPJ || !novaEmpresa.telefone || !novaEmpresa.Data_criacao) {
    return res.status(400).json({ message: 'Dados da empresa inválidos' })
  }

  // Impede CNPJ repetido em outra empresa (ignora a própria)
  const cnpjNormalizado = normalizarCNPJ(novaEmpresa.CNPJ)
  const cnpjEmUso = empresasDB.some(
    emp => emp.ID !== id && normalizarCNPJ(emp.CNPJ) === cnpjNormalizado
  )

  if (cnpjEmUso) {
    return res.status(409).json({ message: 'Já existe uma empresa com este CNPJ' })
  }

  empresaAtual.Nome_corporativo = novaEmpresa.Nome_corporativo
  empresaAtual.Nome_Trade = novaEmpresa.Nome_Trade
  empresaAtual.CNPJ = novaEmpresa.CNPJ
  empresaAtual.telefone = novaEmpresa.telefone
  empresaAtual.Data_criacao = novaEmpresa.Data_criacao

  salvarEmpresasDB()
  res.json({ message: 'Empresa atualizada com sucesso' })
})

/**
 * @swagger
 * /empresas/{id}:
 *   delete:
 *     summary: Exclui uma empresa existente
 *     tags: [Empresas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Empresa excluída com sucesso
 *       404:
 *         description: Empresa não encontrada
 */
router.delete('/:id', (req, res) => {
  const id = req.params.id
  const empresaIndex = empresasDB.findIndex(emp => emp.ID === id)

  if (empresaIndex === -1) {
    return res.status(404).json({ message: 'Empresa não encontrada' })
  }

  empresasDB.splice(empresaIndex, 1)
  salvarEmpresasDB()
  res.json({ message: 'Empresa excluída com sucesso' })
})

module.exports = router
