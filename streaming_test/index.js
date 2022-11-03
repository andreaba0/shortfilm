const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')
const xmlParser = require('xml2js').parseString
const { v4: uuidv4 } = require('uuid')
const bodyParser = require('body-parser')
const childProcess = require('child_process')

app.use('/streaming', express.static(path.join(__dirname, '/streaming')))
app.use(bodyParser.text({ limit: '15mb' }))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'))
})

app.get('/video', (req, res) => {
    res.sendFile(path.join(__dirname, '/upload.html'))
})

app.post('/video', (req, res) => {
    const body = JSON.parse(req.body)
    fs.mkdir(`./pending/${body.video}.${body.tot}/`, { recursive: true }, (err) => {
        if (err) console.log(err.message)
        fs.writeFile(`./pending/${body.video}.${body.tot}/${body.id}.chunk.tmp`, Buffer.from(body.body, 'ascii'), { flag: 'wx' }, (err) => {
            if (err) console.log(err.message)
            fs.rename(`./pending/${body.video}.${body.tot}/${body.id}.chunk.tmp`, `./pending/${body.video}.${body.tot}/${body.id}.chunk`, () => {
                res.status(200).send('OK')
            })
        })
    })
})

async function watchRoutine() {
    fs.stat('streaming', (err, stats) => {
        console.log(stats.mtime)
        setTimeout(watchRoutine, 1000 * 60 * 10)
    })
}

async function clearReadyQueue() {
    return new Promise((resolve, reject) => {
        fs.rm('dash_ready', { recursive: true }, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.log(err.message, err.code)
                resolve(null)
            }
            else fs.mkdir('dash_ready', (err) => {
                if (err) resolve(null)
                else resolve('OK')
            })
        })
    })
}

function updateFile(basePath, chunkID, videoName, chunkLength) {
    const chunk = basePath + `${chunkID}.chunk`
    const tempVideoName = `${videoName}.tmp`
    if (chunkID === chunkLength) {
        fs.renameSync(tempVideoName, videoName)
        fs.rmSync(basePath, { recursive: true })
        childProcess.exec(`ffprobe -i ${videoName} -print_format json -show_streams -v quiet`, (err, stdout, stderr) => {
            if(err) {
                console.log(err.message)
                return
            }
            console.log(stdout)
        })
        return
    }
    fs.readFile(chunk, {}, (err, data) => {
        if (err) return
        fs.appendFile(tempVideoName, data, {}, () => {
            console.log('chunk: ', chunk)
            fs.unlink(chunk, (err) => {
                if (err) console.log(err.message)
                else updateFile(basePath, chunkID + 1, videoName, chunkLength)
            })
        })
    })
}

function enqueueVideo(basePath, chunks, videoName) {
    updateFile(basePath, 0, './queue/' + videoName + '.mp4', chunks.length)
}

function enqueue() {
    const basePath = './pending/'
    fs.readdir(basePath, {}, (err, files) => {
        if (err) {
            console.log(err.message)
            return
        }
        files.map(file => {
            fs.stat(basePath + file, (err, obj) => {
                if (obj.isDirectory() === false) return
                fs.readdir(basePath + file, {}, (err, subFiles) => {
                    var res = new Array(subFiles.length)
                    if (err) {
                        console.log(err.message)
                        return
                    }
                    const parts = file.split('.')
                    if (subFiles.length !== parseInt(parts[1])) return
                    var ok = 1
                    for (var i = 0; i < subFiles.length; i++)
                        if (subFiles[i].match(/.tmp/)) ok = 0
                    if (!ok) return
                    enqueueVideo(basePath + file + '/', subFiles, parts[0])
                })
            })
        })
    })
    setTimeout(enqueue, 1000 * 15)
}

async function init() {
    const readyQueueCleared = await clearReadyQueue()
    if (readyQueueCleared !== 'OK') return
    app.listen(3000, () => {
        console.log('Server is running')
        watchRoutine()
        enqueue()
    })
}
init()