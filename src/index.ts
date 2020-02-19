/// <reference path="./types/index.d.ts" />

import {createServer as _createHttpServer} from 'http'
import {server as _webSocketServer} from 'websocket'

import fs from  'fs'
import {resolve} from 'path'

import {remoteAddrToMovieId, toCliSignal, fromCliSignal} from './resolver'
import {log} from './util'
import * as websocketHandler from './handler/websocket'

import {test, prod} from './setting'

var connectedDevices: ConnectedDevices = new Array()

let status: string

// 0: pause, 1: step
var step = 0
var experienceStep = 0

const HttpServer = _createHttpServer((request, response) => {
  log(`Request to: ${request.url}.`)
  const path = (request.url as string).split('?')[0]

  switch (path) {
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
    case '/step-pause': // ステップ一時停止
      log(`Step Pause`)
      WebSocketServer.connections.forEach(connection => {
        connection.send(JSON.stringify({
          signal: toCliSignal.SEEK_PAUSE
        }))
      })
      response.write(`step pause ok`)
      break
    case '/step-play': // ステップ再生
      log(`Step Play`)
      step--
      stepExec.next()
      response.write(`step play ok`)
      break
    case '/return': // これの次は /start のみ
      log(`原点復帰`)
      returnStep()
      response.write(`原点復帰 ok`)
      break
    case '/connection-list':  // 繋いでいるクライアントを表示
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
  autoAcceptConnections: false,
  closeTimeout: 3500,
  keepaliveInterval: 7500,
})

var stepExec: Generator<string, void, number>

WebSocketServer.on('request', function (request) {
  const connection = request.accept()
  connection.on('message', function (msg) {
    const payload = (msg.type === 'utf8')
      ? JSON.parse(msg.utf8Data as string)
      : msg.binaryData as Buffer
    log(payload)

    // @note !isPlayable ? return を消したので、動作に注意する 

    wsRoute(payload, connection)
  })
  connection.on('close', websocketHandler.close)
})

function wsRoute (payload: any, connection?: any) {
  switch(payload.signal) {
    case fromCliSignal.SET_DEVICE:
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
    case fromCliSignal.CLI_PLAY_STOP:
      log(`movie stop: movieId=${payload.movieId} is stop.`)
      stepExec.next()
      break
    case fromCliSignal.CLI_SEARCH_EXPERIENCE:
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
          signal: toCliSignal.SEEK_INIT
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
      signal: toCliSignal.SEEK_INIT
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
      signal: toCliSignal.SEEK_INIT
    }))
  })
}