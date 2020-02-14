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
var isPlayable: boolean = true

// 0: pause, 1: step
var step = 0
var experienceStep = 0

const HttpServer = _createHttpServer((request, response) => {
  log(`Request to: ${request.url}.`)
  const path = (request.url as string).split('?')[0]

  const params = (request.url as string).split('?').length >= 2? (request.url as string).split('?')[1]
    .split('&')
    .map(v => {
      return {
        param: v.split('=')[0],
        val: v.split('=')[1]
      }
    }) : [] 

  switch (path) {
    case '/start':
      isPlayable = true
      start(prod)
      status = prod
      response.write('start ok')
      break
    case '/restart':
      isPlayable = true
      restart(prod)
      status = prod
      response.write('restart ok')
      break
    case '/test-start':
      isPlayable = true
      start(test)
      status = test
      response.write('test start ok')
      break
    case '/test-restart':
      isPlayable = true
      restart(test)
      status = test
      response.write('test restart ok')
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
    case '/step-stop':
      log(`Step stop`)
      if(isPlayable === false)
        break
      if(step-1 < 0)
        break

      isPlayable = false

      let nextSetting = JSON.parse(fs.readFileSync(resolve(process.cwd(), 'sequences', status == test ? test : prod, 'timeline.json')).toString())[step-1]
      if(nextSetting.signal == "2") // 多分違う
        experienceStep++
    
      response.write(`step stop ok`)
      break
    case '/step-restart':
      log(`Step restart`)
      isPlayable = true
      response.write(`step restart ok`)
      stepExec.next()
      break
    case '/set':
      log(`param set`)
      if(params.length !== 0){}
      response.write(`param set ok`)
      break
    case '/reborn':
      log(`復活`)
      stepExec.next()
      response.write(`復活 ok`)
      break
    case '/recovery':
      log(`再復活`)
      step = step - 1 < -1 ? -1 : step - 1
      stepExec.next()
      response.write(`再復活 ok`)
      break
    case '/return':
      log(`原点復帰`)
      returnStep()
      response.write(`原点復帰 ok`)
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

    // swicthの中身をモジュールにして、isPlayable === trueにするトリガで再生開始したい
    if(isPlayable === false) return

    restartRecentStep(payload, connection)

  })
  connection.on('close', websocketHandler.close)
})

function restartRecentStep (payload: any, connection?: any) {
  // 0: set device, 1: stopTiming, 2: markTiming, 3: setTime
  switch(payload.signal) {
    case 0:
      connectedDevices.push({
        movieId: payload.movieId,
        addr: connection.socket.remoteAddress
      })
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
}

// signal 2: all clear, 3: control
function * generator (dir: string) {
  while(true){
    let setting = JSON.parse(fs.readFileSync(resolve(process.cwd(), 'sequences', dir, 'timeline.json')).toString())
    log(setting[step])
    WebSocketServer.connections.forEach(connection => {
      connection.send(JSON.stringify(setting[step]))
    })
    yield setting[step].signal
    step = step + 1
    if(!(step < setting.length)){
      step = 0
      experienceStep = 0
      log('loop')
      WebSocketServer.connections.forEach(connection => {
        connection.send(JSON.stringify({
          signal: 2
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

function returnStep () {
  step = 0
  experienceStep = 0
  WebSocketServer.connections.forEach(connection => {
    connection.send(JSON.stringify({
      signal: 2
    }))
  })
}