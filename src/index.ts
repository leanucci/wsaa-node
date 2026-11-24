/**
 * A Node.js client for AFIP's WSAA (Web Service de Autenticación y Autorización).
 *
 * @packageDocumentation
 */
export { WsaaClient, WSAA_ENDPOINTS, type WsaaClientConfig, type WsaaEnvironment } from "./client.js";
export { loadCredentials, type CredentialsConfig, type LoadedCredentials } from "./credentials.js";
export { WsaaCredentialsError, WsaaError, WsaaResponseError, WsaaSoapFaultError } from "./errors.js";
export { signLoginTicketRequest } from "./sign.js";
export {
  buildLoginCmsEnvelope,
  findSoapFault,
  parseLoginCmsResponse,
  WSAA_NAMESPACE,
  type LoginTicket,
} from "./soap.js";
export {
  buildLoginTicketRequest,
  DEFAULT_EXPIRATION_OFFSET_MS,
  DEFAULT_GENERATION_OFFSET_MS,
  formatDateTime,
  type LoginTicketRequest,
  type LoginTicketRequestOptions,
} from "./tra.js";
