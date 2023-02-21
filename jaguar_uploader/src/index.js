import { v4 as uuidv4 } from 'uuid';
import CryptoJs from 'crypto-js';

//On page load
(function () {
    const host = window.location.hostname;
    const socket = new WebSocket(`ws://${host}/pubsub`);
    socket.onopen = () => {
        console.log('Connected to redis pubsub');
    }
    socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log(data);
    }

    function isFetchOk(code) {
        return code >= 200 && code < 300;
    }

    var uploads = []
    const initUpload = async (file, videoId) => {
        const response = await fetch(`/api/upload/begin/${videoId}`, {
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
        if (response.status >= 200 && response.status < 300) return true
        return false
    }
    const commitUpload = async (file, videoId) => {
        const response = await fetch(`/api/upload/commit/${videoId}`, {
            method: 'POST'
        })
        if (response.status >= 200 && response.status < 300) return true
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
                    if (end > fileSize) end = fileSize
                    promises.push(
                        new Promise(async (resolve, reject) => {
                            const chunkStart = start
                            const chunkEnd = end
                            console.log(chunkStart, chunkEnd)
                            const chunk = new Uint8Array(reader.result.slice(chunkStart, chunkEnd))
                            const hash = CryptoJs.SHA256(CryptoJs.lib.WordArray.create(reader.result.slice(chunkStart, chunkEnd))).toString(CryptoJs.enc.Hex)
                            async function upload() {
                                return new Promise(async (resolve, reject) => {
                                    try {
                                        const response = await fetch(`/api/upload/chunk/${videoId}`, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/octet-stream',
                                                'Content-Range': `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
                                                'Content-Hash': hash
                                            },
                                            body: chunk
                                        })
                                        if (isFetchOk(response.status)) return resolve()
                                        reject()
                                    } catch (e) {
                                        reject()
                                    }
                                })
                            }
                            var backoff = 0
                            while (backoff < 9) {
                                try {
                                    await upload()
                                    return resolve()
                                } catch (e) {
                                    console.log('retrying...')
                                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, backoff)))
                                    backoff++
                                }
                            }
                            reject()
                        })
                    )
                    start = end
                    end += chunkSize
                    if (promises.length < 10) continue
                    try {
                        await Promise.all(promises)
                        promises = []
                    } catch (e) {
                        return reject()
                    }
                }
                if (promises.length == 0) return resolve()
                try {
                    await Promise.all(promises)
                    promises = []
                } catch (e) {
                    return reject()
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