/**
 * Builds the `loginCms` SOAP request and reads the SOAP response.
 *
 * @packageDocumentation
 */
import { XMLParser } from "fast-xml-parser";
import { WsaaResponseError, WsaaSoapFaultError } from "./errors.js";

/** The XML namespace of the `loginCms` operation, from the WSAA WSDL. */
export const WSAA_NAMESPACE = "http://wsaa.view.sua.dvadac.desein.afip.gov";

/**
 * The access ticket (TA) that WSAA returns.
 */
export interface LoginTicket {
  /** The TOKEN value. Send it to the target web service. Do not log it. */
  token: string;
  /** The SIGN value. Send it to the target web service. Do not log it. */
  sign: string;
  /** The time that WSAA generated the access ticket. */
  generationTime: Date;
  /** The time that the access ticket expires. */
  expirationTime: Date;
}

const parser = new XMLParser({
  removeNSPrefix: true,
  parseTagValue: false,
  ignoreAttributes: true,
  trimValues: true,
});

type XmlNode = Record<string, unknown>;

function child(node: unknown, name: string): unknown {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    return (node as XmlNode)[name];
  }
  return undefined;
}

function text(node: unknown): string | undefined {
  if (typeof node === "string") {
    return node;
  }
  const value = child(node, "#text");
  return typeof value === "string" ? value : undefined;
}

function parse(xml: string, what: string): unknown {
  try {
    return parser.parse(xml);
  } catch {
    // Do not include the XML. It can contain the TOKEN and the SIGN.
    throw new WsaaResponseError(`The ${what} is not valid XML.`);
  }
}

function parseDate(value: string | undefined, name: string): Date {
  const date = value === undefined ? new Date(Number.NaN) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new WsaaResponseError(`The access ticket has no valid ${name}.`);
  }
  return date;
}

/**
 * Builds the SOAP envelope for the WSAA `loginCms` operation.
 *
 * @param cms - The signed login ticket request, as a Base64-encoded CMS message.
 * @returns The SOAP envelope XML.
 */
export function buildLoginCmsEnvelope(cms: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="${WSAA_NAMESPACE}">` +
    "<soapenv:Header/>" +
    "<soapenv:Body>" +
    `<wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms>` +
    "</soapenv:Body>" +
    "</soapenv:Envelope>"
  );
}

/**
 * Finds a SOAP fault in a SOAP response.
 *
 * @param soapXml - The SOAP response XML.
 * @returns The fault error, or `undefined` if the response has no fault.
 */
export function findSoapFault(soapXml: string): WsaaSoapFaultError | undefined {
  const body = child(child(parse(soapXml, "WSAA response"), "Envelope"), "Body");
  const fault = child(body, "Fault");
  if (fault === undefined) {
    return undefined;
  }
  const faultCode = text(child(fault, "faultcode")) ?? "unknown";
  const faultString = text(child(fault, "faultstring")) ?? "No fault message.";
  return new WsaaSoapFaultError(faultCode, faultString);
}

/**
 * Reads the access ticket from a `loginCms` SOAP response.
 *
 * @param soapXml - The SOAP response XML.
 * @param now - The current time, to check that the access ticket is not expired. The default is the time of the call.
 * @returns The TOKEN, the SIGN, and the times of the access ticket.
 * @throws {@link WsaaSoapFaultError} if the response contains a SOAP fault.
 * @throws {@link WsaaResponseError} if the response is not valid, or if the access ticket is expired.
 */
export function parseLoginCmsResponse(soapXml: string, now: Date = new Date()): LoginTicket {
  const fault = findSoapFault(soapXml);
  if (fault !== undefined) {
    throw fault;
  }

  const body = child(child(parse(soapXml, "WSAA response"), "Envelope"), "Body");
  const ticketXml = text(child(child(body, "loginCmsResponse"), "loginCmsReturn"));
  if (ticketXml === undefined) {
    throw new WsaaResponseError("The WSAA response has no loginCmsReturn element.");
  }

  const ticket = child(parse(ticketXml, "access ticket"), "loginTicketResponse");
  const header = child(ticket, "header");
  const credentials = child(ticket, "credentials");
  const token = text(child(credentials, "token"));
  const sign = text(child(credentials, "sign"));
  if (token === undefined || token === "" || sign === undefined || sign === "") {
    throw new WsaaResponseError("The access ticket has no TOKEN or no SIGN.");
  }

  const generationTime = parseDate(text(child(header, "generationTime")), "generationTime");
  const expirationTime = parseDate(text(child(header, "expirationTime")), "expirationTime");
  if (expirationTime.getTime() <= now.getTime()) {
    throw new WsaaResponseError("The access ticket is expired.");
  }
  if (generationTime.getTime() > expirationTime.getTime()) {
    throw new WsaaResponseError("The access ticket generationTime is after its expirationTime.");
  }

  return { token, sign, generationTime, expirationTime };
}
