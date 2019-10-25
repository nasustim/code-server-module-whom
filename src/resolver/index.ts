
export const remoteAddrToMovieId = (remoteAddr: string, connectedDevices: ConnectedDevices) => 
  connectedDevices.find(con => con.addr === remoteAddr)
