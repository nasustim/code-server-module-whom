"use strict";
/// <reference path="./types/index.d.ts" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const websocket_1 = require("websocket");
const fs_1 = __importDefault(require("fs"));
const resolver_1 = require("./resolver");
const util_1 = require("./util");
var connectedDevices = new Array();
const HttpServer = http_1.createServer((request, response) => {
    util_1.log(`Request to: ${request.url}.`);
    switch (request.url) {
        case '/start':
            start();
            response.write('start ok');
            break;
        case '/restart':
            restart();
            response.write('restart ok');
            break;
        default:
            console.warn(`Recieve Request to Undefined URI: ${request.url}`);
            response.writeHead(404);
            break;
    }
    response.end();
});
HttpServer.listen(3003, () => {
    util_1.log(`Listen in 3003 Port...`);
});
const WebSocketServer = new websocket_1.server({
    httpServer: HttpServer,
    autoAcceptConnections: true // key of allow cross-origin-request
});
// 0: pause, 1: step
var step = 0;
var stepExec;
var experienceStep = 0;
function start() {
    util_1.log(`Start steps.`);
    stepExec = generator('2019-yobishin1');
    stepExec.next();
}
function restart() {
    util_1.log(`Restart steps.`);
    step = 0;
    experienceStep = 0;
    WebSocketServer.connections.forEach(connection => {
        util_1.log('loop');
        connection.send(JSON.stringify({
            signal: 2
        }));
    });
    stepExec = generator('2019-yobishin1');
    stepExec.next();
}
/*app.get('/test-start',function (req, res) {
  stepExec = generator('test01')
  stepExec.next()
  res.send('ok')
})
app.get('/test-restart',function (req, res) {
  step = 0
  experienceStep = 0
  connects.forEach(socket => {
    console.log('test loop')
    socket.send(JSON.stringify({
      signal: 2
    }))
  })
  stepExec = generator('test01')
  stepExec.next()
  res.send('restart ok')
})*/
const keepAlive = setInterval(function () {
    WebSocketServer.connections.forEach(connection => {
        connection.send(JSON.stringify({
            signal: 30,
            movieId: '30'
        }));
    });
}, 3000);
// signal 2: all clear, 3: control
function* generator(dir) {
    while (true) {
        let setting = JSON.parse(fs_1.default.readFileSync(`../${dir}/timeline.json`).toString());
        util_1.log(setting[step]);
        WebSocketServer.connections.forEach(connection => {
            connection.send(JSON.stringify(setting[step]));
        });
        yield setting[step].signal;
        step++;
        if (!(step < setting.length)) {
            step = 0;
            experienceStep = 0;
            util_1.log('loop');
            WebSocketServer.connections.forEach(connection => {
                connection.send(JSON.stringify({
                    signal: 2
                }));
                connection.send(JSON.stringify({
                    movieId: '9',
                    command: 0,
                    rule: ' true ',
                    signal: 3
                }));
            });
        }
    }
}
WebSocketServer.on('request', function (request) {
    const connection = request.accept();
    connection.on('message', function (msg) {
        const payload = (msg.type === 'utf8')
            ? JSON.parse(msg.utf8Data)
            : msg.binaryData;
        util_1.log(payload);
        // 0: set device, 1: stopTiming, 2: markTiming
        switch (payload.signal) {
            case 0:
                connectedDevices.push({
                    movieId: payload.movieId,
                    addr: connection.socket.remoteAddress
                });
                connection.socket.remoteAddress;
                util_1.log(`set device: \\
            movieId=${payload.movieId}, \\
            IpAddress=${connection.socket.remoteAddress}`);
                break;
            case 1:
                util_1.log(`movie stop: movieId=${payload.movieId} is stop.`);
                stepExec.next();
                break;
            case 2:
                let experienceSetting = JSON.parse(fs_1.default.readFileSync('../2019-yobishin1/changeExperience.json').toString());
                util_1.log(`experience filtering: movieId=${payload.movieId}`);
                WebSocketServer.connections.forEach(connection => {
                    connection.send(JSON.stringify(experienceSetting[experienceStep]));
                });
                util_1.log(experienceSetting[experienceStep]);
                experienceStep++;
                if (experienceStep >= experienceSetting.length)
                    experienceStep = 0;
                stepExec.next();
                break;
        }
        util_1.log(`Connecting Device List: ${WebSocketServer.connections.map(con => resolver_1.remoteAddrToMovieId(con.socket.remoteAddress, connectedDevices))}`);
    });
    connection.on('close', close);
    connection.on('error', close);
});
//# sourceMappingURL=index.js.map