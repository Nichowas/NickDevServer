var clientData = []
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
        clientData[c.cid].turn = this.needing
        this.needing = { white: 'black', black: null }[this.needing]
        clientData[c.cid].index = this.clients.length
        this.clients.push(c)
    }
    removeClient(c, dlt = true) {
        this.needing = clientData[c.cid].turn

        this.clients.splice(clientData[c.cid].index, 1)
        for (let i = clientData[c.cid].index; i < this.clients.length; i++) {
            clientData[this.clients[i].cid].index--
        }
        delete clientData[c.cid].turn
        delete clientData[c.cid].index

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
            return room.clients.map(client => ({ name: clientData[client.cid].name }))
        })
    }
    static emitData(io) {
        io.emit('rooms', this.toData())
    }
}

module.exports.Room = Room
module.exports.clientData = clientData