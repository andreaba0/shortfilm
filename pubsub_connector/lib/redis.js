const redis = require('redis');
const dotenv = require('dotenv');
dotenv.config();

const client = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        reconnectStrategy: (retries) => {
            return 1000;
        },
    },
    disableOfflineQueue: true,
});

client.on('error', (e) => {
    console.log(e.message)
})

client.on('ready', () => {
    console.log('ready to accept connection')
})

client.on('reconnecting', () => {
    console.log('Reconnecting')
})

client.on('connect', () => {
    console.log('connected')
})

function getClient() {
    return client;
}

module.exports = {
    getClient,
}
