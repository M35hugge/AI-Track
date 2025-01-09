const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the "public" directory
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('a user connected');

    // Listen for track data from the frontend
    socket.on('trackData', (trackData) => {
        console.log('Track data received:', trackData);

        // You can send this data to all other connected clients (broadcast)
        // io.emit('trackData', trackData);

        // Optionally, process the data on the server
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server listening on *:3000');
});
