const
    port = process.env.PORT,
    app = require("express")(),
    http = require("http").createServer(app),
    io = require("socket.io")(http, {
        cors: {
            origin: '*',
        }
    })
http.listen(port);
var socketCount = 0;
var ls;
io.on("connection", (client) => {
    console.log(`${socketCount + 1} client${socketCount > 0 ? 's' : ''} connected`)
    let room = Math.floor(socketCount / 2)
    client.on('update', (data) => {
        client.to(`Game ${room}`).emit('update', data)
    })

    client.join(`Game ${room}`)
    if (socketCount % 2 == 0) {
        ls = client;
    } else {
        ls.emit('ready', 0)
        client.emit('ready', 1)
    }
    socketCount++;
})