const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')
const xmlParser = require('xml2js').parseString
const { v4: uuidv4 } = require('uuid')
const bodyParser = require('body-parser')
const childProcess = require('child_process')
const { getClient: getRedisClient } = require('./lib/redis')
const {
    createEmptyFile,
    createDirectory,
    writeToFileAt,
    writeStringToFile,
    readDirectory,
    readStringFromFile,
    deleteFile
} = require('./utility')
const v8 = require('v8')
const crypto = require('crypto')

var concurrentActiveProcesses = 0

async function deleteBlobData(blobName) {
    try {
        await deleteFile(path.join(__dirname, `blob/${blobName}.${blobDatabase[blobName].file.container}`))

    } catch (e) {
        if (e.code !== 'ENOENT')
            console.error(`Failed to delete blob ${blobName}: ${e.message}`)
    }
    try {
        await deleteFile(path.join(__dirname, `manifest/${blobName}.json`))
    } catch (e) {
        if (e.code !== 'ENOENT')
            console.error(`Failed to delete manifest ${blobName}: ${e.message}`)
    }
}

setInterval(async () => {
    for (var key in expireBlobs) {
        if (expireBlobs[key] > Date.now()) continue

        await deleteBlobData(key)
        delete blobDatabase[key]
        delete expireBlobs[key]
    }
    for (var key in blobDatabase) {
        if (blobDatabase[key].file.status !== 'uploaded') continue
        delete expireBlobs[key]
        if (concurrentActiveProcesses > 4) continue
        concurrentActiveProcesses++
        await getRedisClient().publish('any', JSON.stringify({
            type: 'validate',
            id: key,
            progress: 0
        }));
        validateVideo(key)
    }
}, 5000)

function validateVideo(videoId) {
    const ffprobe = childProcess.spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        path.join(__dirname, `blob/${videoId}.${blobDatabase[videoId].file.container}`)
    ])
    var ffprobeOutput = ''
    ffprobe.stdout.on('data', (data) => {
        console.log(process.memoryUsage())
        ffprobeOutput += data
        const headStatistics = v8.getHeapStatistics()
        const heapUsed = headStatistics.used_heap_size
        const heapLimit = headStatistics.heap_size_limit
        console.log(`used: ${parseInt(heapUsed / (1024 * 1024))}MB, limit: ${parseInt(heapLimit / (1024 * 1024))}MB, ratio: ${(heapUsed / heapLimit) * 100}%`)
    }
    )
    ffprobe.on('close', async (code) => {
        concurrentActiveProcesses--
        if (code !== 0) {
            console.error(`Failed to execute ffprobe: ${code}`)
            await deleteBlobData(videoId)
            await getRedisClient().publish('any', JSON.stringify({
                type: 'error',
                id: videoId,
                message: 'Invalid video file'
            }));
            delete blobDatabase[videoId]
            return
        }
        try {
            var codecVideo = 0
            var codecAudio = 0
            const videoMetadata = JSON.parse(ffprobeOutput)
            for (var i = 0; i < videoMetadata.streams.length; i++) {
                if (videoMetadata.streams[i].codec_type === 'video') codecVideo++
                if (videoMetadata.streams[i].codec_type === 'audio') codecAudio++
            }
            if (codecVideo === 1 && codecAudio > 0) {
                blobDatabase[videoId].file.status = 'validated'
                await writeStringToFile(JSON.stringify(blobDatabase[videoId]), path.join(__dirname, `manifest/${videoId}.json`))
                await getRedisClient().publish('any', JSON.stringify({
                    type: 'validate',
                    id: videoId,
                    progress: 100
                }));
                return
            }
            await deleteBlobData(videoId)
            await getRedisClient().publish('any', JSON.stringify({
                type: 'error',
                id: videoId,
                message: {
                    video: {
                        found: codecVideo,
                        expected: '=1'
                    },
                    audio: {
                        found: codecAudio,
                        expected: '>0'
                    }
                }
            }));
            delete blobDatabase[videoId]
        } catch (e) {
            console.error(`Failed to parse ffprobe output: ${e.message}`)
            console.error(e)
        }
    })
}

app.use('/streaming', express.static(path.join(__dirname, '/streaming')))
app.use(bodyParser.text({ limit: '10mb' }))
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }))
app.use(bodyParser.raw({ limit: '10mb', type: 'application/octet-stream' }))

var blobDatabase = {}
var expireBlobs = {}

app.post('/upload/begin/:video_id', async (req, res) => {
    const videoId = req.params.video_id
    if (!req.is('application/json')) {
        return res.status(400).send('Request body must be a json object')
    }
    const metadata = req.body
    if (!metadata.size || !metadata.container || !metadata.name) {
        return res.status(400).send('Missing size or container')
    }
    if (isNaN(metadata.size)) {
        return res.status(400).send('Size must be a number')
    }
    const fileSize = parseInt(metadata.size)
    if (fileSize <= 0) {
        return res.status(400).send('Size must be greater than 0')
    }
    if (fileSize > 10737418240) {
        return res.status(400).send('Size must be less than 10GB')
    }
    try {
        await writeStringToFile(JSON.stringify({
            file: {
                size: fileSize,
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
                size: fileSize,
                container: metadata.container,
                status: 'uploading'
            },
            metadata: {
                name: metadata.name,
            },
            options: {}
        }
        return res.status(201).send('Upload started')
    } catch (e) {
        return res.status(500).send('Error while writing manifest')
    }
})

app.post('/upload/chunk/:video_id', async (req, res) => {
    const videoId = req.params.video_id
    const range = req.headers['content-range']
    const bytes = Buffer.from(req.body, 'binary')
    if (!range) {
        return res.status(400).send('Missing content-range header')
    }
    const hash = crypto.createHash('sha256').update(bytes).digest('hex')
    const expectedHash = req.headers['content-hash']
    if (hash !== expectedHash) {
        return res.status(400).send('Invalid content hash')
    }
    const start = parseInt(range.split('-')[0].split(' ')[1])
    const end = parseInt(range.split('-')[1].split('/')[0])
    const size = parseInt(range.split('/')[1])
    if (start + bytes.length > blobDatabase[videoId].file.size) {
        return res.status(400).send('Invalid content-range header')
    }
    try {
        await writeToFileAt(bytes, path.join(__dirname, `blob/${videoId}.${blobDatabase[videoId].file.container}`), start)
    } catch (e) {
        console.log(e)
        return res.status(500).send('Error while writing to file')
    }
    res.status(201).send('OK')
})

app.post('/upload/commit/:video_id', async (req, res) => {
    const videoId = req.params.video_id
    blobDatabase[videoId].file.status = 'uploaded'
    try {
        await writeStringToFile(JSON.stringify(blobDatabase[videoId]), path.join(__dirname, `manifest/${videoId}.json`))
    } catch (e) {
        return res.status(500).send('Error while writing manifest')
    }
    await getRedisClient().publish('any', JSON.stringify({
        status: 'upload',
        id: videoId,
        progress: 100
    }))
    res.status(201).send('OK')
})

app.post('/upload/cancel/:video_id', async (req, res) => {
    const videoId = req.params.video_id
    try {
        await deleteFile(path.join(__dirname, `manifest/${videoId}.json`))
        await deleteFile(path.join(__dirname, `blob/${videoId}.${blobDatabase[videoId].file.container}`))
        delete blobDatabase[videoId]
    } catch (e) {
        return res.status(500).send('Error while deleting files')
    }
    res.status(201).send('OK')
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'))
})

async function init() {
    try {
        await createDirectory(path.join(__dirname, 'blob'))
        await createDirectory(path.join(__dirname, 'manifest'))
        const files = await readDirectory(path.join(__dirname, 'manifest'))
        for (const file of files) {
            const content = await readStringFromFile(path.join(__dirname, `manifest/${file}`))
            const videoId = file.split('.')[0]
            blobDatabase[videoId] = JSON.parse(content)
            if (blobDatabase[videoId].file.status === 'uploading') {
                expireBlobs[videoId] = new Date(new Date().getTime() + (1000 * 60 * 2))
            }
        }
        await getRedisClient().connect()
    } catch (e) {
        console.log(e)
        console.error('Error while creating directories')
        process.exit(1)
    }
    app.listen(3000, () => {
        console.log('Listening on port 3000')
    })
}
init()