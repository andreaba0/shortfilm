const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const dotenv = require('dotenv').config()

const app = express()

app.use('/static/', express.static('dist'))

app.get('/:video_id', async (req, res) => {
    res.sendFile(path.join(__dirname, '/dist/index.html'))
})

app.listen(3003, () => {
    console.log('Server is listening')
})