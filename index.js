const express = require('express')
const swaggerUi = require('swagger-ui-express')
const swaggerJsDoc = require('swagger-jsdoc')
const routes = require('./src/routes')
const cors = require('cors')
const app = express()
const PORT = 3000



app.use(cors())
app.use(express.json())

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Reservamento de salas",
            version: "1.0.0",
            description: "API para realizar reservas de salas",
        license: {
            name: 'Licenciado para DA 2',
        },
        contact: {
            name: 'José Henrique Pereira Pimentel',
            name: ' Gabriel de Bona'
        },
            },
            servers: [
                {
                    url: "http://localhost:3000/",
            description: 'Development server',
                },
            ],
    },
    apis: ["./src/routes/*.js"]
};

const specs = swaggerJsDoc(options)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs))

app.use(function(req, res, next){ //
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
    res.setHeader("Access-Control-Allow-Headers", "content-type")
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Access-Control-Allow-Credentials", true)
    next()
   })//
app.use('/', routes)

app.listen(PORT, function () {
    console.log(`Aplicação executando na porta ${PORT}!`)
})