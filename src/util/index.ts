/// <reference path="../types/index.d.ts" />

export function log (msg: DisplayableData) {
  if(typeof msg === "object"){
    console.log(setTimeStamp('↓↓ variable dump ↓↓'))
    console.dir(msg)
  }else{
    console.log(setTimeStamp(msg))
  }
}

export const setTimeStamp = (msg: DisplayableData): string => {
  let date = new Date()
  return `${date.getFullYear()}/${('00'+date.getMonth()).slice(-2)}/${('00'+date.getDate()).slice(-2)}-${('00'+date.getHours()).slice(-2)}:${('00'+date.getMinutes()).slice(-2)}:${('00'+date.getSeconds()).slice(-2)}: ${msg}`
}