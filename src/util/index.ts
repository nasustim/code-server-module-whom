/// <reference path="../types/index.d.ts" />

export function log (msg: DisplayableData) {
  msg = typeof msg === 'object' ? JSON.stringify(msg) : msg
  console.log(setTimeStamp(msg))
}

export function warn (msg :DisplayableData) {
  msg = typeof msg === 'object' ? JSON.stringify(msg) : msg
  console.warn(setTimeStamp(msg))
}

export const setTimeStamp = (msg: DisplayableData): string => {
  let date = new Date()
  return `${date.getFullYear()}/${('00'+date.getMonth()).slice(-2)}/${('00'+date.getDate()).slice(-2)}-${('00'+date.getHours()).slice(-2)}:${('00'+date.getMinutes()).slice(-2)}:${('00'+date.getSeconds()).slice(-2)}: ${msg}`
}