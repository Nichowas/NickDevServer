const discord = require('discord.js')
const client = new discord.Client()
const token = "NzQ3MzU4MzE0MzMyOTQ2NTEy.X0Ntqw.i20BCJ0hcJqlTDx69cbkABgq9Lk"
var channel

const Data = {
    header: null,
    tagHandle: {},
    save: async (tag, data) => {
        let msg = await channel.send(data)
        await Data.set(tag, msg.id)
        return msg.id
    },
    get: async (tag) => {
        let str = Data.header.content
        let tags = str.split('\n').splice(1).map(t => t.split(':'))
        let id = tags.find(t => t[0] === tag)[1]

        return (await channel.messages.fetch(id)).content
    },
    initHeader: async () => {
        Data.header = await channel.send('HEADER\n')
    },
    set: async (tag, data) => {
        Data.tagHandle[tag] = data
        let str = 'HEADER\n'
        for (let [i, v] of Object.entries(Data.tagHandle)) str += `${i}:${v}\n`
        await Data.header.edit(str)
        return str
    }
}


client.on('ready', async () => {
    channel = client.channels.cache.find((c) => c.name == 'testing')

    console.log('Connected')

    let nchannel = await channel.clone()
    channel.delete()
    channel = nchannel

    await Data.initHeader()


    let dta = await Data.save('name', 'Ooga Booga')
    let name = await Data.get('name')
    console.log(name)
    // await channel.send('Bot is working')
})
client.login(token)