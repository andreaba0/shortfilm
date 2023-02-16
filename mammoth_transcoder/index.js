const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')
const xmlParser = require('xml2js').parseString
const { v4: uuidv4 } = require('uuid')
const bodyParser = require('body-parser')
const childProcess = require('child_process')
const { createEmptyFile, createDirectory, writeToFileAt } = require('./utility')

app.use('/streaming', express.static(path.join(__dirname, '/streaming')))
app.use(bodyParser.text({ limit: '10mb' }))
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))

var blobDatabase = {}

/**
 * This endpoint is used to initialize the uploading schema
 * The request body is a json string containing the video metadata
 */
app.post('/upload/begin/:video_id', async(req, res) => {
    const videoId = req.params.video_id
    //parse a js object to a json file
    const metadata = JSON.parse(req.body)
    //return error code if no size or video container is provided
    if (!metadata.size || !metadata.container || !metadata.name) {
        return res.status(400).send('Missing size or container')
    }
    //write an empty js object to manifest_videoId.json file
    try {
        await writeStringToFile(JSON.stringify({
            file: {
                size: metadata.size,
                container: metadata.container,
                status: 'uploading'
            },
            metadata: {
                name: metadata.name,
            },
            options: {}
        }), path.join(__dirname, `manifest/${videoId}.json`))
        //create an empty file in the form videoId.container
        await createEmptyFile(path.join(__dirname, `blob/${videoId}.${metadata.container}`))
        blobDatabase[videoId] = {
            file: {
                size: metadata.size,
                container: metadata.container,
                status: 'uploading'
            },
            metadata: {
                name: metadata.name,
            },
            options: {}
        }
    } catch(e) {
        return res.status(500).send('Error while writing manifest')
    }
})

/**
 * This endpoint is used to upload chunks of the video in the file blob/videoId.container
 * This endpoint put a chunk of the video in the file blob/videoId.container
 * The request body is a binary string containing the chunk
 * The chunk start position is given by client in the request content-range header
 * Chunk length given by the client+chunk start position must be at most the file size
 * Request body must be passed as a binary array
 * Content type must be application/octet-stream
 * Method used is PUT
 */
app.put('/upload/:video_id', async(req, res) => {
    const videoId = req.params.video_id
    const range = req.headers['content-range']
    //check content type is application/octet-stream
    if (req.headers['content-type'] !== 'application/octet-stream') {
        return res.status(400).send('Invalid content-type')
    }
    //bytes must be a binary array
    const bytes = Buffer.from(req.body, 'binary')
    if (!range) {
        return res.status(400).send('Missing content-range header')
    }
    const start = parseInt(range.split('-')[0].split(' ')[1])
    const end = parseInt(range.split('-')[1].split('/')[0])
    const size = parseInt(range.split('/')[1])
    if (start + bytes.length > size) {
        return res.status(400).send('Invalid content-range header')
    }
    try {
        await writeToFileAt(path.join(__dirname, `blob/${videoId}.${blobDatabase[videoId].file.container}`), bytes, start)
    } catch(e) {
        return res.status(500).send('Error while writing to file')
    }
    res.status(201).send('OK')
})

/**
 * This endpoint is used to finalize the upload
 * It updates the manifest file and the blob database
 */
app.post('/upload/commit/:video_id', async(req, res) => {
    const videoId = req.params.video_id
    blobDatabase[videoId].file.status = 'uploaded'
    try {
        await writeStringToFile(JSON.stringify(blobDatabase[videoId]), path.join(__dirname, `blob/${videoId}.json`))
    } catch(e) {
        return res.status(500).send('Error while writing manifest')
    }
    res.status(201).send('OK')
})

/**
 * This endpoint is used to cancel the upload
 * It deletes the manifest file and the blob file
 * It also updates the blob database
 */
app.post('/upload/cancel/:video_id', async(req, res) => {
    const videoId = req.params.video_id
    try {
        await deleteFile(path.join(__dirname, `manifest/${videoId}.json`))
        await deleteFile(path.join(__dirname, `blob/${videoId}.${blobDatabase[videoId].file.container}`))
        delete blobDatabase[videoId]
    } catch(e) {
        return res.status(500).send('Error while deleting files')
    }
    res.status(201).send('OK')
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'))
})


/**
 * This function is used to setup the system before accepting requests
 * It creates the blob and the manifest directory if they do not exists
 */
async function init() {
    try {
        await createDirectory(path.join(__dirname, 'blob'))
        await createDirectory(path.join(__dirname, 'manifest'))
    } catch(e) {
        console.log(e)
        console.error('Error while creating directories')
        process.exit(1)
    }
    app.listen(3000, () => {
        console.log('Listening on port 3000')
    })
}
init()