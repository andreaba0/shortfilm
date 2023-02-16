const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const dotenv = require('dotenv').config()

const app = express()

app.use('/static/', express.static('dist'))

app.get('/video/upload', async (req, res) => {
    res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.listen(3001, () => {
    console.log('Server is listening')
})