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

        this.moves = []

        this.needing = 'white'
    }
    addMove(m) {
        this.moves.push(m)
    }
    addClient(c) {
        c.cdata.turn = this.needing
        this.needing = { white: 'black', black: null }[this.needing]
        c.cdata.index = this.clients.length
        this.clients.push(c)
    }
    removeClient(c, dlt = true) {
        this.needing = c.cdata.turn

        this.clients.splice(c.cdata.index, 1)
        for (let i = c.cdata.index; i < this.clients.length; i++) {
            this.clients[i].cdata.index--
        }
        delete c.cdata.turn
        delete c.cdata.index

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
    static toRoomData() {
        return this.rooms.map(room => {
            return room.clients.map(client => ({
                name: client.cdata.name,
                id: client.cdata.userId
            }))
        })
    }
    static emitRoomData(io) {
        io.emit('rooms', this.toRoomData())
    }
}

module.exports.Room = Room