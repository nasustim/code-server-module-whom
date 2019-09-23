const _express = require('express')
const app = _express()
const _ws = require('express-ws')(app)

// 0: pause, 1: step
const fs = require('fs')

let step = 0
let stepExec

let experienceStep = 0

let devices = []
let connects = []

app.get('/start',function (req, res) {
  stepExec = generator('2019-yobishin1')
  stepExec.next()
  res.send('ok')
})
app.get('/restart',function (req, res) {
  step = 0
  experienceStep = 0
  connects.forEach(socket => {
    console.log('loop')
    socket.send(JSON.stringify({
      signal: 2
    }))
  })
  stepExec = generator('2019-yobishin1')
  stepExec.next()
  res.send('restart ok')
})
app.get('/test-start',function (req, res) {
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
})

const liveCheck = setInterval(() => {
  connects = connects.filter(socket => {
    if(socket.readyState != socket.OPEN)
      return false
    else
      return true
  })
},1000)

const keepAlive = setInterval(function () {
  connects.forEach(socket => {
    socket.send(JSON.stringify({
      signal: 30,
      movieId: '30'
    }))
  })
}, 3000)

// signal 2: all clear, 3: control
function * generator (dir) {
  while(true){
    let setting = JSON.parse(fs.readFileSync(`./${dir}/timeline.json`))
    connects.forEach(socket => {
      console.log(setting[step])
      socket.send(JSON.stringify(setting[step]))
    })
    yield setting[step].signal
    step++
    if(!(step < setting.length)){
      step = 0
      experienceStep = 0
      connects.forEach(socket => {
        console.log('loop')
        socket.send(JSON.stringify({
          signal: 2
        }))
        socket.send(JSON.stringify({
          movieId: '9',
          command: 0, // 0: display all, 1: search
          rule: ' true ', // search rule
          signal: 3
        }))
      })
    }
  }
}

app.ws('/', function (ws, req) {

  connects.push(ws)

  ws.on('message', function (msg) {
    const payload = JSON.parse(msg)

    console.log(payload)

    // 0: set device, 1: stopTiming, 2: markTiming
    switch(payload.signal) {
      case 0: 
        console.log(`set device: ${payload.movieId}`)
        devices.push(payload.movieId)
        break
      case 1:
        console.log(`movie stop signal: ${payload.movieId}`)
        stepExec.next()
        break
      case 2:
        let experienceSetting = JSON.parse(fs.readFileSync('./2019-yobishin1/changeExperience.json'))
        console.log(`movie stepper signal: ${payload.movieId}`)
        connects.forEach(socket => {
          socket.send(JSON.stringify(experienceSetting[experienceStep]))
        })
        console.log(experienceSetting[experienceStep])
        experienceStep++
        if(experienceStep >= experienceSetting.length)
          experienceStep = 0
        stepExec.next()
        break
    }

    console.log(`movies: ${devices}`)
  })
  ws.on('close', close)
  ws.on('error', close)
})

app.listen(3001)

function close (msg) {
  console.log(msg)
}