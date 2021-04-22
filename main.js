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

var { Room } = require('./room.js')

const url = "mongodb+srv://nichowas:Nicky123@cluster0.ywd4q.mongodb.net/devsite"
var { MongoClient } = require('mongodb')
var clientDB = new MongoClient(url), database, userCollection
clientDB.connect((err) => {
    if (err) throw err
    database = clientDB.db('devsite');
    userCollection = database.collection('users')
    // loadFromDB(userCollection)
    console.log('connected to database')
})

async function main(client) {
    Room.emitData(io)

    let LEAVE = () => {
        if (room) {
            io.to(room.id).emit('leave')
            let dlt = room.removeClient(client)
            room = undefined
            return dlt
        }
        return false
    }

    let room, userId
    client.on('join', (i = undefined) => {
        let I
        if (room) I = room.rid
        let dlt = LEAVE(true)
        room = i !== undefined ? Room.rooms[i - (dlt && I < i) ? 1 : 0] : new Room(2)
        room.addClient(client)
        client.join(room.id)

        client.emit('join', room.rid, client.turn)
        room.fullEmit((c) => c.emit('ready'))

        Room.emitData(io)
    })
    client.on('update', (data) => {
        room.addMove(data)
        client.to(room.id).emit('update', room.moves)
    })

    client.on('disconnect', () => {
        LEAVE(); Room.emitData(io)
    })
    client.on('leave', () => { LEAVE(); Room.emitData(io) })
    client.on('game-end', async (data, won) => {
        let other = room.clients.filter(c => c.id !== client.id)[0]
        if (won == 0) {
            // client.wins++

        }

        let cd = await userCollection.findOne({ _id: userId })
        let cw = cd.wins, cl = cd.losses

        let od = await userCollection.findOne({ _id: other.userId })
        let ow = od.wins, ol = od.losses

        if (won == 1) {
            cw++; ol++;

            await userCollection.updateOne({ _id: userId }, { $set: { wins: cw } })
            await userCollection.updateOne({ _id: other.userId }, { $set: { losses: ol } })
        }
        if (won == 2) {
            ow++; cl++

            await userCollection.updateOne({ _id: other.userId }, { $set: { wins: ow } })
            await userCollection.updateOne({ _id: userId }, { $set: { losses: cl } })
        }
        Room.deleteRoom(room.rid)
        other.emit('game-end', data, ow, ol)
        client.emit('game-end', data, cw, cl)

        Room.emitData(io)
    })
    client.on('game-end2', () => { room = undefined })

    client.on('user-signin', async (gid, name) => {
        userId = await userCollection.findOne({ gid })
        let w, l
        if (userId === null) {
            userId = (await userCollection.insertOne({ gid, name, wins: 0, losses: 0 })).insertedId
            w = 0, l = 0
        } else {
            w = userId.wins, l = userId.losses
            userId = userId._id
            await userCollection.updateOne({ gid }, { $set: { name } })
        }
        client.name = name
        client.userId = userId

        client.emit('user-signin', w, l)
    })
}
io.on('connection', main)

// Comments for forcing changes
// CHANGE COUNT: 0

process.on('beforeExit', (code) => {
    clientDB.close()
    console.log('leaving with code: ', code);
});
