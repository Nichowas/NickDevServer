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

    console.log('connected to database')
    ready.databaseConnected = true
    ready.testStart()
})

async function main(client) {

    let cdata = {
        client, room: null, userId: null,
        turn: null, name: null
    }
    client.cdata = cdata

    Room.emitRoomData(io)
    client.on('join', (i) => join(cdata, i))
    client.on('update', (data) => update(cdata, data))
    client.on('disconnect', () => disconnect(cdata))
    client.on('leave', () => leave(cdata))
    client.on('game-end', (data, won) => gameEnd(cdata, data, won))
    client.on('user-signin', (gid, name, src) => userSignin(cdata, gid, name, src))
    client.on('user-signout', () => userSignout(cdata))
    client.on('guest-signin', () => guestSignin(cdata))

    ready.onStart(async () => {
        client.emit('start', await getTopUsers(5))
    })
}

function join(cdata, i = undefined) {
    let I
    if (cdata.room) I = cdata.room.rid
    let dlt = cdata.room !== undefined
    if (cdata.room) Room.deleteRoom(cdata.room.rid);
    cdata.room = i !== undefined ? Room.rooms[i - (dlt && I < i) ? 1 : 0] : new Room(2)
    cdata.room.addClient(cdata.client)
    cdata.client.join(cdata.room.id)

    cdata.client.emit('join', cdata.room.rid, cdata.turn)
    cdata.room.fullEmit((c) => c.emit('ready'))

    Room.emitRoomData(io)
}
function update(cdata, data) {
    cdata.room.addMove(data)
    cdata.client.to(cdata.room.id).emit('update', cdata.room.moves)
}

function disconnect(cdata) {
    userSignout(cdata, false)
}
function leave(cdata) {
    if (cdata.room) Room.deleteRoom(cdata.room.rid);
    Room.emitRoomData(io)
}

const K = 32
const eB = 10
const eS = 400
function calcE(Ra, Rb) { return 1 / (1 + Math.pow(eB, (Rb - Ra) / eS)) }
function newRatings(Ra, Rb, S) {
    return [
        Ra + Math.floor(K * (S - calcE(Ra, Rb))),
        Rb + Math.floor(K * (1 - S - calcE(Rb, Ra)))
    ]
}
async function gameEnd(cdata, data, won) {
    let other = cdata.room.clients.filter(c => c.id !== cdata.client.id)[0]

    let cd = await userCollection.findOne({ _id: cdata.userId })
    let cw = cd.wins, cl = cd.losses, cr = cd.rating;

    let od = await userCollection.findOne({ _id: other.cdata.userId })
    let ow = od.wins, ol = od.losses, or = od.rating;

    cw += won == 2; cl += won == 0;
    ow += won == 0; ol += won == 2;
    if (!cd.guest && !od.guest) [cr, or] = newRatings(cr, or, won / 2)
    console.log(cr, or)
    await userCollection.updateOne({ _id: /*  */cdata.userId }, { $set: { wins: cw, losses: cl, rating: cr } })
    await userCollection.updateOne({ _id: other.cdata.userId }, { $set: { wins: ow, losses: ol, rating: or } })

    Room.deleteRoom(cdata.room.rid);

    other.emit('game-end', data, ow, ol)
    cdata.client.emit('game-end', data, cw, cl)

    Room.emitRoomData(io)
    io.emit('users', await getTopUsers(5))
}

async function getTopUsers(num = 5) {
    return (await userCollection.find({
        guest: { $exists: false }
    }).sort({ rating: -1 }).limit(num).toArray()).map(u => ({
        id: u._id,
        gid: u.gid, name: u.name, src: u.src,
        wins: u.wins, losses: u.losses, rating: u.rating,
        online: u.online
    }))
}
async function userSignin(cdata, gid, name, src) {
    await userCollection.updateOne({ _id: cdata.userId, guest: { $exists: false } }, { $set: { online: false } })

    let userId = await userCollection.findOne({ gid })
    let w, l
    if (userId === null) {
        cdata.userId = (await userCollection.insertOne({ gid, name, src, wins: 0, losses: 0, online: true, rating: 1000 })).insertedId
        w = 0, l = 0
    } else {
        w = userId.wins, l = userId.losses
        cdata.userId = userId._id
        await userCollection.updateOne({ gid }, { $set: { name, src, online: true } })

    }
    cdata.name = name
    Room.emitRoomData(io)

    cdata.client.emit('user-signin', w, l)
    io.emit('users', await getTopUsers(5))
}
async function userSignout(cdata, gsi = true) {
    if (cdata.room) await gameEnd(cdata, undefined, 0)

    await userCollection.updateOne({ _id: cdata.userId }, { $set: { online: false } })

    if (gsi)
        await guestSignin(cdata)
    Room.emitRoomData(io)
}
async function guestSignin(cdata) {
    cdata.userID = (await userCollection.findOne({ guest: { $exists: true } }))._id
    cdata.name = 'Guest'
}

io.on('connection', main)