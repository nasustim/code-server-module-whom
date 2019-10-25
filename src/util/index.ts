/// <reference path="../types/index.d.ts" />

let date = new Date()

export function log (msg: DisplayableData) {
  console.log(
    `${date.getMonth()}/${date.getDate()} \\
    ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} \\
      : ${msg}`
  )
}