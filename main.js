// port = 3000,
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
console.log(port)

app.post('/deploy', (req, res) => {
    console.log(req, res)
})

class Room {
    static rooms = [];
    static idcount = 0;
    constructor(size) {
        this.rid = Room.rooms.length
        Room.rooms.push(this)
        this.id = `Game #${Room.idcount}`
        Room.idcount++
        this.size = size
        this.clients = []
    }
    addClient(c) {
        c.index = this.clients.length
        this.clients.push(c)
    }
    removeClient(c, dlt = true) {
        this.clients.splice(c.index, 1)
        for (let i = c.index; i < this.clients.length; i++) {
            this.clients[i].index--
        }
        delete c.index

        if (dlt && this.clients.length == 0) {
            Room.deleteRoom(this.rid)
            return true
        }
        return false
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
    static deleteRoom(i) {
        while (this.rooms[i].clients.length > 0) this.rooms[i].removeClient(this.rooms[i].clients[0], false)
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

    let LEAVE = (sw = false) => {
        if (room) {
            let dlt = room.removeClient(client)

            if (!dlt)
                client.to(room.id).emit('soft-leave')
            if (!sw)
                client.emit('hard-leave')
            room = undefined
            return dlt
        }
        return false
    }

    let room
    client.on('join', (name, i = undefined) => {
        client.name = name
        let I
        if (room) I = room.rid
        let dlt = LEAVE(true)
        room = i !== undefined ? Room.rooms[i - (dlt && I < i) ? 1 : 0] : new Room(2)
        room.addClient(client)
        client.join(room.id)

        client.emit('join', room.rid)
        room.fullEmit((c, i) => c.emit('ready', i))

        Room.emitData()
    })

    client.on('update', (data) => {
        client.to(room.id).emit('update', data)
    })

    client.on('disconnect', () => { LEAVE(); Room.emitData() })
    client.on('leave', () => { LEAVE(); Room.emitData() })
    client.on('game-end', (data) => {
        Room.deleteRoom(room.rid)
        io.to(room.id).emit('game-end', data)

        Room.emitData()
    })
    client.on('game-end2', () => { room = undefined })
})

