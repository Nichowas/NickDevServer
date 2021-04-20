const url = "mongodb+srv://nichowas:Nicky123@cluster0.ywd4q.mongodb.net/devsite"
// const url = "mongodb://127.0.0.1/devsite"

var { MongoClient } = require('mongodb')
const client = new MongoClient(url)

async function main(err) {
    if (err) throw err

    var db = client.db('devsite')
    var users = db.collection('users')

    let then = await users.findOne({ name: 'nichowas' })
    await users.updateOne({ name: 'nichowas' }, { $set: { wins: 1 } })
    let now = await users.findOne({ name: 'nichowas' })

    console.log(then, now)
    client.close()
}
client.connect(main)


