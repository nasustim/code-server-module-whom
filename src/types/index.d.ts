import Http from 'http'
import Websocket from 'websocket'

type ConnectedDevice = {movieId: string, addr: string|undefined}
type ConnectedDevices = Array<ConnectedDevice>
type DisplayableData = string | number | Object | Array<any>

type Tests = "test01"
type Prods = "2019-yobishin1" | "archive-20190924" | "iamas2020"


interface HTTPHandler {
  request: Http.ClientRequest
  response: Http.ServerResponse
  path: string
  data: any
}
