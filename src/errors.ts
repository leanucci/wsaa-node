/**
 * Error classes that the WSAA client raises.
 *
 * @remarks
 * No error message contains the private key, the TOKEN, or the SIGN value.
 *
 * @packageDocumentation
 */

/**
 * The base class for all errors that this package raises.
 */
export class WsaaError extends Error {
  /**
   * Creates an error.
   *
   * @param message - A description of the problem.
   */
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The certificate or the private key is missing, unreadable, or invalid,
 * or the two do not match.
 *
 * @remarks
 * The client raises this error before it calls WSAA.
 */
export class WsaaCredentialsError extends WsaaError {}

/**
 * WSAA returned a SOAP fault.
 */
export class WsaaSoapFaultError extends WsaaError {
  /** The fault code from WSAA, for example `ns1:cms.cert.expired`. */
  readonly faultCode: string;
  /** The fault message from WSAA. */
  readonly faultString: string;

  /**
   * Creates a SOAP fault error.
   *
   * @param faultCode - The `faultcode` value from the SOAP fault.
   * @param faultString - The `faultstring` value from the SOAP fault.
   */
  constructor(faultCode: string, faultString: string) {
    super(`WSAA returned a SOAP fault (${faultCode}): ${faultString}`);
    this.faultCode = faultCode;
    this.faultString = faultString;
  }
}

/**
 * The WSAA response is not valid, or the HTTP request failed.
 *
 * @remarks
 * The message never contains the response body, because the body can contain the TOKEN and the SIGN.
 */
export class WsaaResponseError extends WsaaError {}
