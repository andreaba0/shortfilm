const { WebSocketServer } = require('ws');
const { getClient: getRedisClient } = require('./lib/redis')
const dotenv = require('dotenv');
dotenv.config();

const server = new WebSocketServer({ port: 3002 });

server.on('connection', (socket) => {
    console.log('A client has connected.');

    socket.on('message', (message) => {
    });

    socket.on('close', () => {
        console.log('A client has disconnected.');
    });
});

async function init() {
    const subscriber = getRedisClient()
    await subscriber.connect()
    await subscriber.subscribe('any', (message, channel) => {
        if (channel !== 'any') return
        server.clients.forEach((client) => {
            client.send(message)
        })
    })
}
init()
