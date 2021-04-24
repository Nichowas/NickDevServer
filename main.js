const
    port = process.env.PORT || 3000,
    app = require("express")(),
    http = require("http").createServer(app),
    io = require("socket.io")(http, { cors: { origin: '*' } })

var ready = {
    socketConnected: false,
    databaseConnected: false,
    callbacks: [],
    testStart() {
        if (ready.socketConnected && ready.databaseConnected)
            ready.start()
    },
    onStart(f) {
        if (ready.socketConnected && ready.databaseConnected)
            f()
        else
            ready.callbacks.push(f)
    },
    start() {
        ready.callbacks.forEach(f => f())
        ready.callbacks = []
    }
}

http.listen(port, () => {
    console.log(`connected to PORT:${port}`);
    ready.socketConnected = true;
    ready.testStart()
});

var { Room } = require('./room.js')

const url = "mongodb+srv://nichowas:Nicky123@cluster0.ywd4q.mongodb.net/devsite"
var { MongoClient } = require('mongodb')
var clientDB = new MongoClient(url, { useUnifiedTopology: true }), database, userCollection


clientDB.connect((err) => {
    if (err) throw err
    database = clientDB.db('devsite');
    userCollection = database.collection('users')
    ready.databaseConnected = true
    ready.testStart()
    console.log('connected to database')
})

async function main(client) {

    let cdata = {
        client, room: null, userId: null,
        turn: null, name: null
    }
    client.cdata = cdata

    Room.emitData(io)
    client.on('join', (i) => join(cdata, i))
    client.on('update', (data) => update(cdata, data))
    client.on('disconnect', () => disconnect(cdata))
    client.on('leave', () => leave(cdata))
    client.on('game-end', (data, won) => gameEnd(cdata, data, won))
    client.on('game-end2', () => { cdata.room = undefined })
    client.on('user-signin', (gid, name) => userSignin(cdata, gid, name))
    client.on('user-signout', () => userSignout(cdata))
    client.on('guest-signin', () => guestSignin(cdata))

    ready.onStart(() => client.emit('start'))
}
function leaveRoom(cdata) {
    if (cdata.room) {
        io.to(cdata.room.id).emit('leave')
        let dlt = cdata.room.removeClient(cdata.client)
        cdata.room = undefined
        return dlt
    }
    return false
}
function join(cdata, i = undefined) {
    let I
    if (cdata.room) I = cdata.room.rid
    let dlt = leaveRoom(cdata)
    cdata.room = i !== undefined ? Room.rooms[i - (dlt && I < i) ? 1 : 0] : new Room(2)
    cdata.room.addClient(cdata.client)
    cdata.client.join(cdata.room.id)

    cdata.client.emit('join', cdata.room.rid, cdata.turn)
    cdata.room.fullEmit((c) => c.emit('ready'))

    Room.emitData(io)
}
function update(cdata, data) {
    cdata.room.addMove(data)
    cdata.client.to(cdata.room.id).emit('update', cdata.room.moves)
}
function disconnect(cdata) {
    leaveRoom(cdata);
    Room.emitData(io)
}
function leave(cdata) {
    leaveRoom(cdata);
    Room.emitData(io)
}
async function gameEnd(cdata, data, won) {
    let other = cdata.room.clients.filter(c => c.id !== cdata.client.id)[0]
    if (won == 0) {
        // client.wins++

    }

    let cd = await userCollection.findOne({ _id: cdata.userId })
    let cw = cd.wins, cl = cd.losses

    let od = await userCollection.findOne({ _id: other.cdata.userId })
    let ow = od.wins, ol = od.losses

    if (won == 1) {
        cw++; ol++;

        await userCollection.updateOne({ _id: cdata.userId }, { $set: { wins: cw } })
        await userCollection.updateOne({ _id: other.cdata.userId }, { $set: { losses: ol } })
    }
    if (won == 2) {
        ow++; cl++

        await userCollection.updateOne({ _id: other.cdata.userId }, { $set: { wins: ow } })
        await userCollection.updateOne({ _id: cdata.userId }, { $set: { losses: cl } })
    }
    Room.deleteRoom(room.rid)
    other.emit('game-end', data, ow, ol)
    cdata.client.emit('game-end', data, cw, cl)

    Room.emitData(io)
}
async function userSignin(cdata, gid, name) {
    await userCollection.updateOne({ _id: cdata.userId, guest: { $exists: false } }, { $set: { online: false } })

    let userId = await userCollection.findOne({ gid })
    let w, l
    if (userId === null) {
        cdata.userId = (await userCollection.insertOne({ gid, name, wins: 0, losses: 0, online: true })).insertedId
        w = 0, l = 0
    } else {
        w = userId.wins, l = userId.losses
        cdata.userId = userId._id
        await userCollection.updateOne({ gid }, { $set: { name, online: true } })
    }
    cdata.name = name
    cdata.client.emit('user-signin', w, l)

    Room.emitData(io)
}
async function userSignout(cdata) {
    // leaveRoom(cdata)

    await userCollection.updateOne({ _id: cdata.userID }, { $set: { online: false } })

    await guestSignin(cdata)
    Room.emitData(io)
}
async function guestSignin(cdata) {
    cdata.userID = (await userCollection.findOne({ guest: true }))._id
    cdata.name = 'Guest'
}

io.on('connection', main)