/**
 * The WSAA client.
 *
 * @packageDocumentation
 */
import { loadCredentials, type CredentialsConfig } from "./credentials.js";
import { WsaaResponseError, type WsaaSoapFaultError } from "./errors.js";
import { signLoginTicketRequest } from "./sign.js";
import { buildLoginCmsEnvelope, findSoapFault, parseLoginCmsResponse, type LoginTicket } from "./soap.js";
import { buildLoginTicketRequest, type LoginTicketRequestOptions } from "./tra.js";

/**
 * The WSAA environment: `testing` (homologación) or `production`.
 */
export type WsaaEnvironment = "testing" | "production";

/**
 * The WSAA `loginCms` endpoint for each environment.
 */
export const WSAA_ENDPOINTS: Readonly<Record<WsaaEnvironment, string>> = Object.freeze({
  testing: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  production: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
});

/**
 * The configuration of a {@link WsaaClient}.
 */
export interface WsaaClientConfig extends CredentialsConfig {
  /** The WSAA environment to call. */
  environment: WsaaEnvironment;
  /** The `fetch` function to send HTTP requests. The default is the global `fetch`. */
  fetch?: typeof fetch;
}

/**
 * A client for the AFIP WSAA `loginCms` service.
 *
 * @example
 * ```ts
 * const client = new WsaaClient({
 *   environment: "testing",
 *   certificatePath: "/secure/cert.pem",
 *   privateKeyPath: "/secure/key.pem",
 * });
 * const { token, sign, expirationTime } = await client.login("wsfe");
 * ```
 */
export class WsaaClient {
  /** The `loginCms` endpoint URL that this client calls. */
  readonly endpoint: string;

  readonly #config: WsaaClientConfig;
  readonly #fetch: typeof fetch;

  /**
   * Creates a client.
   *
   * @param config - The environment, the certificate, and the private key.
   * @throws RangeError if the environment is not `testing` or `production`.
   */
  constructor(config: WsaaClientConfig) {
    if (!Object.hasOwn(WSAA_ENDPOINTS, config.environment)) {
      throw new RangeError('The environment must be "testing" or "production".');
    }
    this.endpoint = WSAA_ENDPOINTS[config.environment];
    this.#config = { ...config };
    this.#fetch = config.fetch ?? globalThis.fetch;
  }

  /**
   * Gets an access ticket (TOKEN and SIGN) for one target AFIP web service.
   *
   * @remarks
   * The client builds a login ticket request, signs it, and sends it to WSAA.
   * It checks the certificate and the private key before it calls WSAA.
   *
   * The client uses `options.now` for all times of the request: the times in the
   * login ticket request, the CMS signing time, and the expiry check of the access ticket.
   * If you set `now` to a time after the expiration time of the access ticket,
   * the client throws {@link WsaaResponseError}. Set `now` only for tests.
   *
   * @param service - The target AFIP web service, for example `wsfe`.
   * @param options - Options for the login ticket request.
   * @returns The TOKEN, the SIGN, and the times of the access ticket.
   * @throws {@link WsaaCredentialsError} if the certificate or the private key is missing, unreadable, or does not match.
   * @throws {@link WsaaSoapFaultError} if WSAA returns a SOAP fault.
   * @throws {@link WsaaResponseError} if the HTTP request fails or the response is not valid.
   */
  async login(service: string, options: LoginTicketRequestOptions = {}): Promise<LoginTicket> {
    // Use one clock value for all times of this request.
    const now = options.now ?? new Date();
    const request = buildLoginTicketRequest(service, { ...options, now });
    const credentials = loadCredentials(this.#config);
    const cms = signLoginTicketRequest(request.xml, credentials, now);
    const soapXml = await this.#post(buildLoginCmsEnvelope(cms));
    return parseLoginCmsResponse(soapXml, now);
  }

  async #post(envelope: string): Promise<string> {
    let response: Response;
    let body: string;
    try {
      response = await this.#fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' },
        body: envelope,
      });
      body = await response.text();
    } catch (error) {
      throw new WsaaResponseError(`Cannot call WSAA at ${this.endpoint}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      const fault = body.includes("Fault") ? findFaultOrUndefined(body) : undefined;
      if (fault !== undefined) {
        throw fault;
      }
      throw new WsaaResponseError(`WSAA returned HTTP status ${response.status}.`);
    }
    return body;
  }
}

/**
 * Finds a SOAP fault in the body of an HTTP error response.
 *
 * @returns The fault error, or `undefined` if the body has no fault or is not valid XML.
 */
function findFaultOrUndefined(body: string): WsaaSoapFaultError | undefined {
  try {
    return findSoapFault(body);
  } catch {
    // The body is not valid XML. Use the HTTP status message.
    return undefined;
  }
}
