const
    port = process.env.PORT || 8080,
    app = require("express")(),
    http = require("http").createServer(app),
    io = require("socket.io")(http, {
        cors: {
            origin: '*',
        }
    })
http.listen(port);
console.log(port)
class Room {
    static rooms = [];
    constructor(size) {
        Room.rooms.push(this)
        this.rid = Room.rooms.length
        this.id = `Game ${this.rid}`
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

        if (this.clients.length == 0) {
            Room.deleteRoom(this.rid)
        }
    }
    acceptingClient(c, i) {
        return this.clients.length < this.size && (!c.opponent || c.opponent === this.clients[0].name)
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
    static deleteRoom(i) {
        this.rooms.splice(i, 1)
        for (let j = i; j < this.rooms.length; j++) {
            this.rooms[j].rid = j
        }
    }
    static toData() {
        return this.rooms.map(room => {
            return room.clients.map(client => ({ name: client.name }))
        })
    }
    static emitData() {
        io.emit('rooms', this.toData())
    }
}

io.on("connection", (client) => {
    Room.emitData()

    let room
    client.on('join', (name, opponent) => {
        client.name = name
        client.opponent = opponent

        if (room) room.removeClient(client)
        room = Room.findRoom(client)
        room.addClient(client)
        client.join(room.id)


        client.emit('join')
        room.fullEmit((c, i) => c.emit('ready', i))

        Room.emitData()
    })

    client.on('update', (data) => {
        client.to(room.id).emit('update', data)
    })

    client.on('disconnect', () => {
        if (room) {
            client.to(room.id).emit('leave')
            room.removeClient(client)
        }

        Room.emitData()
    })
})

