import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

/** A test certificate and its private key, as PEM text. */
export interface TestIdentity {
  certificate: string;
  privateKey: string;
}

/**
 * Creates a self-signed RSA certificate and its private key for tests.
 *
 * @param commonName - The common name of the certificate subject.
 * @returns The certificate and the private key, as PEM text.
 */
export function createTestIdentity(commonName = "test"): TestIdentity {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "Test SA" },
    { name: "countryName", value: "AR" },
    { type: "2.5.4.5", value: "CUIT 20123456780" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(forge.pki.privateKeyFromPem(privateKeyPem), forge.md.sha256.create());

  return { certificate: forge.pki.certificateToPem(cert), privateKey: privateKeyPem };
}

/**
 * Builds a successful WSAA `loginCms` SOAP response, as WSAA sends it.
 *
 * @param ticket - The values of the access ticket.
 * @returns The SOAP response XML.
 */
export function successResponse(ticket: {
  token: string;
  sign: string;
  generationTime: string;
  expirationTime: string;
}): string {
  const inner =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<loginTicketResponse version="1.0">\n' +
    "  <header>\n" +
    "    <source>CN=wsaahomo, O=AFIP, C=AR, SERIALNUMBER=CUIT 33693450239</source>\n" +
    "    <destination>SERIALNUMBER=CUIT 20123456780, CN=test</destination>\n" +
    "    <uniqueId>383953094</uniqueId>\n" +
    `    <generationTime>${ticket.generationTime}</generationTime>\n` +
    `    <expirationTime>${ticket.expirationTime}</expirationTime>\n` +
    "  </header>\n" +
    "  <credentials>\n" +
    `    <token>${ticket.token}</token>\n` +
    `    <sign>${ticket.sign}</sign>\n` +
    "  </credentials>\n" +
    "</loginTicketResponse>\n";
  const escaped = inner.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<soapenv:Body>" +
    '<loginCmsResponse xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
    `<loginCmsReturn>${escaped}</loginCmsReturn>` +
    "</loginCmsResponse>" +
    "</soapenv:Body>" +
    "</soapenv:Envelope>"
  );
}

/**
 * Builds a WSAA SOAP fault response, as WSAA sends it.
 *
 * @param code - The fault code, without the namespace prefix.
 * @param message - The fault message.
 * @returns The SOAP response XML.
 */
export function faultResponse(code: string, message: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<soapenv:Body>" +
    "<soapenv:Fault>" +
    `<faultcode xmlns:ns1="http://xml.apache.org/axis/">ns1:${code}</faultcode>` +
    `<faultstring>${message}</faultstring>` +
    '<detail><ns2:hostname xmlns:ns2="http://xml.apache.org/axis/">wsaahomo</ns2:hostname></detail>' +
    "</soapenv:Fault>" +
    "</soapenv:Body>" +
    "</soapenv:Envelope>"
  );
}
