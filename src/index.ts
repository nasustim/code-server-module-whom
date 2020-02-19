/// <reference path="./types/index.d.ts" />

import Http, {createServer as _createHttpServer} from 'http'
import {server as _webSocketServer} from 'websocket'

import fs from  'fs'
import {resolve} from 'path'

import {remoteAddrToMovieId, toCliSignal, fromCliSignal} from './resolver'
import {log} from './util'
import {close} from './handler/websocket'

import {test, prod} from './setting'

var connectedDevices: ConnectedDevices = new Array()

let status: string

// movieId = STRING
// 0: pause, 1: step
var step = 0

const HttpServer = _createHttpServer((request: Http.IncomingMessage, response: Http.ServerResponse) => {
  log(`Request to: ${request.url}.`)
  const [path, option] = (request.url as string).split('?')
  try{
    // *?KEY=VALUE&... をオブジェクトに
    const data: any = Object.assign({}, ...option.split('&').map(v => ({[v.split('=')[0]]: v.split('=')[1]})))
    const payload = {
      request, 
      response, 
      path, 
      data
    }
    httpHandle(payload)
  } catch(e) {
    log(`!!! Invalid option format !!!`)
    log(`Valid option format: HOST/?[KEY]=[VALUE]& ...`)
  }
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
  connection.on('close', close)
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
  }

  log(`Connecting Device List`)
  log(WebSocketServer.connections.map(con => remoteAddrToMovieId(con.socket.remoteAddress as string, connectedDevices)))
}

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
      log('loop')
      WebSocketServer.connections.forEach(connection => {
        connection.send(JSON.stringify({
          signal: toCliSignal.SEEK_INIT
        }))
      })
    }
  }
}

// -----------------------------------------------------
// @note 以下の関数、副作用があるので移動するべからず

function httpHandle ({request, response, path, data}) {
  let com: any
  let res: string = ''
  switch (path) {
    /**
     * 全ての端末に作用
     */
    case '/start':  // 全て再生位置を0に; そしてステップを初めからスタート
      step = 0
      com = { signal: toCliSignal.SEEK_INIT }
      stepExec = generator(prod)
      stepExec.next()
      res = 'start ok'
      break
    case '/step-pause': // 全て一時停止
      log(`Step Pause`)
      step--
      com = {signal: toCliSignal.SEEK_PAUSE}
      res = `step pause ok`
      break
    case '/step-play': // ステップ再生
      log(`Step Play`)
      stepExec.next()
      res = `step play ok`
      break
    case '/return': // startの原点復帰のみバージョン
      log(`原点復帰`)
      step = 0
      com = {signal: toCliSignal.SEEK_INIT}
      res = `原点復帰 ok`
      break
    case '/connection-list':  // 繋いでいるクライアントを表示
      log(`Connecting Device List`)
      res = `connection list: ${WebSocketServer.connections.map(con => remoteAddrToMovieId(con.socket.remoteAddress as string, connectedDevices))}`
      com = {signal: toCliSignal.NONE}
      break
    /**
     * クライアントをmovieIdで指定
     * movieId: string, time: number (second)
     */
    case '/seek':
      com = {signal: toCliSignal.SET_SEEK_TIME, movieId: data.movieId, time: parseInt(data.time)}
      break
    case '/select-pause':
      com = {signal: toCliSignal.SEEK_PAUSE, movieId: data.movieId, time: parseInt(data.time)}
      break
    case '/select-play':
      com = {signal: toCliSignal.SEEK_PLAY, movieId: data.movieId, time: parseInt(data.time)}
      break
    default:
      log(`Recieve Request to Undefined URI: ${request.url}`)
      response.writeHead(404)
      return
  }
  WebSocketServer.connections.forEach(connection => {
    connection.send(JSON.stringify(com))
  })
  response.write(res)
  response.end()
}
