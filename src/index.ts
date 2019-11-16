/// <reference path="./types/index.d.ts" />

import {createServer as _createHttpServer} from 'http'
import {server as _webSocketServer} from 'websocket'

import fs from  'fs'
import {resolve} from 'path'

import {remoteAddrToMovieId} from './resolver'
import {log} from './util'
import * as websocketHandler from './handler/websocket'

import {test, prod} from './setting'

var connectedDevices: ConnectedDevices = new Array()

let status: string

const HttpServer = _createHttpServer((request, response) => {
  log(`Request to: ${request.url}.`)
  switch (request.url) {
    case '/start':
      start(prod)
      status = prod
      response.write('start ok')
      break
    case '/restart':
      restart(prod)
      status = prod
      response.write('restart ok')
      break
    case '/test-start':
      start(test)
      status = test
      response.write('test start ok')
      break
    case '/test-restart':
      restart(test)
      status = test
      response.write('test start ok')
      break
    case '/connection-list':
      log(`Connecting Device List`)
      log(WebSocketServer.connections.map(con => remoteAddrToMovieId(con.socket.remoteAddress as string, connectedDevices)))
      response.write(
        `connection list
        ${
          WebSocketServer.connections.map(con => 
            remoteAddrToMovieId(con.socket.remoteAddress as string, connectedDevices)
          )
        }`
      )
      break
    default:
      log(`Recieve Request to Undefined URI: ${request.url}`)
      response.writeHead(404)
      break
  }
  response.end()
})

console.log('######################################')
console.log('### start http and websocket serve ###')
console.log('######################################\n')

HttpServer.listen(3003, () => {
  log(`Listen in 3003 Port...`)
})

const WebSocketServer = new _webSocketServer({
  httpServer: HttpServer,
  disableNagleAlgorithm: true,
  autoAcceptConnections: false
})

// 0: pause, 1: step
var step = 0
var experienceStep = 0

var stepExec: Generator<string, void, number>

const keepAlive = setInterval(function () {
  WebSocketServer.connections.forEach(connection => {
    connection.send(JSON.stringify({
      signal: 30,
      movieId: '30'
    }))
  })
}, 3000)

WebSocketServer.on('request', function (request) {
  const connection = request.accept()
  connection.on('message', function (msg) {
    const payload = (msg.type === 'utf8')
      ? JSON.parse(msg.utf8Data as string)
      : msg.binaryData as Buffer
    log(payload)
    // 0: set device, 1: stopTiming, 2: markTiming
    switch(payload.signal) {
      case 0:
        connectedDevices.push({
          movieId: payload.movieId,
          addr: connection.socket.remoteAddress
        })
        connection.socket.remoteAddress
        log(
          `set device: \\
            movieId=${payload.movieId}, \\
            IpAddress=${connection.socket.remoteAddress}`
        )
        break
      case 1:
        log(`movie stop: movieId=${payload.movieId} is stop.`)
        stepExec.next()
        break
      case 2:
        let experienceSetting = JSON.parse(fs.readFileSync(resolve(process.cwd(), 'sequences', status, 'changeExperience.json')).toString())
        log(`experience filtering: movieId=${payload.movieId}`)
        WebSocketServer.connections.forEach(connection => {
          connection.send(JSON.stringify(experienceSetting[experienceStep]))
        })
        log(experienceSetting[experienceStep])
        experienceStep++
        if(experienceStep >= experienceSetting.length)
          experienceStep = 0
        stepExec.next()
        break
    }

    log(`Connecting Device List`)
    log(WebSocketServer.connections.map(con => remoteAddrToMovieId(con.socket.remoteAddress as string, connectedDevices)))
  })
  connection.on('close', websocketHandler.close)
})

// signal 2: all clear, 3: control
function * generator (dir: string) {
  while(true){
    let setting = JSON.parse(fs.readFileSync(resolve(process.cwd(), 'sequences', dir, 'timeline.json')).toString())
    log(setting[step])
    WebSocketServer.connections.forEach(connection => {
      connection.send(JSON.stringify(setting[step]))
    })
    yield setting[step].signal
    step++
    if(!(step < setting.length)){
      step = 0
      experienceStep = 0
      log('loop')
      WebSocketServer.connections.forEach(connection => {
        connection.send(JSON.stringify({
          signal: 2
        }))
        connection.send(JSON.stringify({
          movieId: '9',
          command: 0, // 0: display all, 1: search
          rule: ' true ', // search rule
          signal: 3
        }))
      })
    }
  }
}

/**
 * start sequence
 * @param pattern 
 */
function start (pattern: string) {
  log(`Start steps.`)
  stepExec = generator(pattern)
  stepExec.next()
}
/**
 * restart sequence
 * @param pattern 
 */
function restart (pattern: string) {
  log(`Restart steps.`)
  step = 0
  experienceStep = 0
  WebSocketServer.connections.forEach(connection => {
    log('loop')
    connection.send(JSON.stringify({
      signal: 2
    }))
  })
  stepExec = generator(pattern)
  stepExec.next()
}