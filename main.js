const
    port = process.env.PORT || 4001,
    app = require("express")(),
    http = require("http").createServer(app),
    io = require("socket.io")(http)
http.listen(port);

io.on("connection", (client) => {
    client.on('msg', (txt) => {
        console.log(txt)
    })
})