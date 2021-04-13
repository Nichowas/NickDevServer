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

class Room {
    static rooms = [];
    constructor(size) {
        Room.rooms.push(this)
        this.id = `Game ${Room.rooms.length}`
        this.size = size
        this.clients = []
    }
    addClient(c) {
        c.index = this.clients.length
        this.clients.push(c)
    }
    removeClient(c) {
        this.clients.splice(c.index, 1)
        for (let i = c.index; i < this.clients.length; i++) {
            this.clients[i].id--
        }
        delete c.index
    }
    acceptingClient(c, i) {
        return this.clients.length < this.size
    }
    fullEmit(f) {
        if (this.clients.length == this.size) { this.clients.forEach(f) }
    }

    static findRoom(c) {
        for (let i = 0; i < this.rooms.length; i++) {
            if (this.rooms[i].acceptingClient(c, i)) return this.rooms[i]
        }
        return new Room(2)
    }
}

io.on("connection", (client) => {
    let room = Room.findRoom(client)
    room.addClient(client)

    client.join(room.id)
    room.fullEmit((c, i) => c.emit('ready', i))

    client.on('update', (data) => {
        client.to(room.id).emit('update', data)
    })

    client.on('disconnect', () => {
        client.to(room.id).emit('leave')
        room.removeClient(client)
    })
})

