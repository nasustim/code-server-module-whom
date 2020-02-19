
export const remoteAddrToMovieId = (remoteAddr: string, connectedDevices: ConnectedDevices) => 
  connectedDevices.find(con => con.addr === remoteAddr)

export const toCliSignal = {
  SET_PAUSE_POINT: 0,
  SET_SEARCH_POINT: 1,
  SEEK_INIT: 2,
  FILTER_EXPERIENCE: 3,
  SEEK_PAUSE: 4,
  SEEK_PLAY: 5,
  SET_SEEK_TIME: 6,
  NONE: 404,
}
export const fromCliSignal = {
  SET_DEVICE: 0,
  CLI_PLAY_STOP: 1,
  CLI_SEARCH_EXPERIENCE: 2,
  RES_SUCCESS: 3,
  RES_FAILURE: 4,
}