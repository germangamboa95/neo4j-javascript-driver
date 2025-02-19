import Context from '../context'
import Controller from './interface'
import stringify from '../stringify'
import { isFrontendError } from '../request-handlers'

/**
 * Local controller handles the requests locally by redirecting them to the correct request handler/service.
 *
 * This controller is used when testing browser and locally.
 */
export default class LocalController extends Controller {
  constructor (requestHandlers = {}, shouldRunTest = () => {}, getFeatures = () => []) {
    super()
    this._requestHandlers = requestHandlers
    this._shouldRunTest = shouldRunTest
    this._getFeatures = getFeatures
    this._contexts = new Map()
  }

  openContext (contextId) {
    this._contexts.set(contextId, new Context(this._shouldRunTest, this._getFeatures))
  }

  closeContext (contextId) {
    this._contexts.delete(contextId)
  }

  async handle (contextId, { name, data }) {
    if (!this._contexts.has(contextId)) {
      throw new Error(`Context ${contextId} does not exist`)
    } else if (!(name in this._requestHandlers)) {
      console.log('Unknown request: ' + name)
      console.log(stringify(data))
      throw new Error(`Unknown request: ${name}`)
    }

    return await this._requestHandlers[name](this._contexts.get(contextId), data, {
      writeResponse: (response) => this._writeResponse(contextId, response),
      writeError: (e) => this._writeError(contextId, e),
      writeBackendError: (msg) => this._writeBackendError(contextId, msg)
    })
  }

  _writeResponse (contextId, response) {
    this.emit('response', { contextId, response })
  }

  _writeBackendError (contextId, msg) {
    this._writeResponse(contextId, newResponse('BackendError', { msg }))
  }

  _writeError (contextId, e) {
    if (e.name) {
      if (isFrontendError(e)) {
        this._writeResponse(contextId, newResponse('FrontendError', {
          msg: 'Simulating the client code throwing some error.'
        }))
      } else {
        const id = this._contexts.get(contextId).addError(e)
        this._writeResponse(contextId, newResponse('DriverError', {
          id,
          msg: e.message,
          code: e.code
        }))
      }
      return
    }
    this._writeBackendError(contextId, e)
  }
}

function newResponse (name, data) {
  return {
    name, data
  }
}
