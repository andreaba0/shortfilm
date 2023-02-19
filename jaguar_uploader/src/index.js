import { v4 as uuidv4 } from 'uuid';
import CryptoJs from 'crypto-js';

//On page load
(function () {
    /**
     * When user upload a file, it will be divided in chunks of 5MB and
     * sent to server with address /api/upload/chunk/<videoId>
     * The body of the request must be an array of bytes of the chunk
     * The content-range header must be set to the range of the chunk
     * The content-type must be application/octet-stream
     * The request method must be PUT
     * The first request must be /api/upload/init/<videoId>
     * The last request must be /api/upload/commit/<videoId>
     * A group of request (es 5 or 10) must be sent in parallel
     * If Promise.all fails, the upload must be restarted
     * On the first (init) and last (commit) request must be sent alone
     * The first request contains a body json with data: {name: <fileName>, size: <fileSize>, container: <fileContainer>}
     * The videoId is a UUID V4
     * The fileContainer is the extension of the file
     * The file name is the name of the file
     * The file size is the size of the file expressed in bytes
     */
    var uploads = []
    const initUpload = async (file, videoId) => {
        const response = await fetch(`http://192.168.178.137:3000/upload/begin/${videoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: file.name,
                size: file.size,
                container: file.name.split('.').pop()
            })
        })
        if (response.status>=200&&response.status<300) return true
        return false
    }
    const commitUpload = async (file, videoId) => {
        const response = await fetch(`http://192.168.178.137:3000/upload/commit/${videoId}`, {
            method: 'POST'
        })
        if (response.status>=200&&response.status<300) return true
        return false
    }
    const uploadChunk = async (file, videoId) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsArrayBuffer(file)
            reader.onload = async (e) => {
                var promises = []
                const chunkSize = 5 * 1024 * 1024
                var start = 0;
                var end = chunkSize
                const fileSize = file.size
                const chunks = Math.ceil(fileSize / chunkSize)
                for (let i = 0; i < chunks; i++) {
                    if(end>fileSize) end = fileSize
                    promises.push(
                        new Promise(async (resolve, reject) => {
                            console.log(start, end, fileSize, reader.result.length)
                            console.log(reader.result.slice(start, end))
                            const hash = CryptoJs.SHA256(CryptoJs.lib.WordArray.create(reader.result.slice(start, end))).toString(CryptoJs.enc.Hex)
                            console.log(hash)
                            //send binary array to server with a fetch request
                            const response = await fetch(`http://192.168.178.137:3000/upload/chunk/${videoId}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/octet-stream',
                                    'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`,
                                    'Content-Hash': hash
                                },
                                body: reader.result.slice(start, end)
                            })
                            if (response.status>= 200&&response.status<300) {
                                resolve()
                            } else {
                                console.log(await response.text())
                                reject()
                            }
                        })
                    )
                    start = end
                    end += chunkSize
                    if (promises.length < 10) continue
                    while (1) {
                        i++
                        try {
                            await Promise.all(promises)
                            promises = []
                            break
                        } catch (e) {
                            console.log('upload failed. Retrying...')
                        }
                    }
                }
                if(promises.length==0) return resolve()
                while (1) {
                    try {
                        await Promise.all(promises)
                        promises = []
                        break
                    } catch (e) {
                        console.log('upload failed. Retrying...')
                    }
                }
                resolve()
            }
        })
    }
    const uploadRoutine = async () => {
        const file = uploads.pop()
        const videoId = uuidv4()
        while (await initUpload(file, videoId) === false) {
            console.log('init failed. Retrying...')
        }
        await uploadChunk(file, videoId)
        while (await commitUpload(file, videoId) === false) {
            console.log('commit failed. Retrying...')
        }
        console.log('upload completed')
    }
    const fileInput = document.getElementById('video-file')
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]
        uploads.push(file)
        await uploadRoutine()
    })




})();