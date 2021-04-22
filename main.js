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

var UserCache = []

function getUserData(id) {
    let uc = UserCache.find(u => u.gid === id)
    if (uc) return uc
}
function getUserIndex(id) {
    let uci = UserCache.findIndex(u => u.gid === id)

    return uci
}
function updateUserData(id, obj) {
    let uci = getUserIndex(id)
    if (uci === -1) return -1
    for (let i in obj) {
        UserCache[uci][i] = obj[i]
    }
    return uci
}
function addUser(gid, name, wins = 0, losses = 0) {
    let obj = { gid, name, wins, losses }
    UserCache.push(obj)

    return UserCache.length - 1
}
function loadFromDB(col) {
    col.find().toArray((err, res) => {
        UserCache = res
    })
}
async function loadToDB(col) {
    let gidmap = {};
    (await col.find().toArray()).forEach(dt => { gidmap[dt.gid] = true })
    for (let i in UserCache) {
        if (gidmap[UserCache[i].gid] === true)
            await col.updateOne({ gid: UserCache[i].gid }, { $set: UserCache[i] })
        else
            await col.insertOne(UserCache[i])
    }
}
const url = "mongodb+srv://nichowas:Nicky123@cluster0.ywd4q.mongodb.net/devsite"
var { MongoClient } = require('mongodb')
var clientDB = new MongoClient(url), database, userCollection
clientDB.connect((err) => {
    if (err) throw err
    database = clientDB.db('devsite');
    userCollection = database.collection('users')
    loadFromDB(userCollection)
    console.log('connected to database')
})

let clientCount = 0
async function main(client) {
    clientCount++

    Room.emitData(io)
    let userIndex;

    let LEAVE = () => {
        if (room) {
            io.to(room.id).emit('leave')
            let dlt = room.removeClient(client)
            room = undefined
            return dlt
        }
        return false
    }

    let room
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
        let temp = clientCount
        clientCount--
        if (temp === 1 && clientCount === 0) {
            loadToDB(userCollection)
        }
    })
    client.on('leave', () => { LEAVE(); Room.emitData(io) })
    client.on('game-end', (data, won) => {
        let other = room.clients.filter(c => c.id !== client.id)[0]
        if (won == 0) {
            // client.wins++

        }
        let cw = UserCache[userIndex].wins, cl = UserCache[userIndex].losses
        let ow = UserCache[other.user].wins, ol = UserCache[other.user].losses
        if (won == 1) {
            cw++; ol++;

            updateUserData(UserCache[userIndex].gid, { wins: cw })
            updateUserData(UserCache[other.user].gid, { losses: ol })
        }
        if (won == 2) {
            ow++; cl++

            updateUserData(UserCache[other.user].gid, { wins: ow })
            updateUserData(UserCache[userIndex].gid, { losses: cl })
        }
        Room.deleteRoom(room.rid)
        other.emit('game-end', data, ow, ol)
        client.emit('game-end', data, cw, cl)

        Room.emitData(io)
    })
    client.on('game-end2', () => { room = undefined })

    client.on('user-signin', (gid, name) => {
        userIndex = getUserIndex(gid)
        if (userIndex !== -1)
            updateUserData(gid, { name })
        else {
            userIndex = addUser(gid, name)
        }
        client.user = userIndex
        client.name = UserCache[userIndex].name

        let cw = UserCache[userIndex].wins, cl = UserCache[userIndex].losses
        client.emit('user-signin', cw, cl)

    })

}
io.on('connection', main)

// Comments for forcing changes
// CHANGE COUNT: 0

process.on('beforeExit', (code) => {
    clientDB.close()
    console.log('leaving with code: ', code);
});
