/**
 * Signs the login ticket request as a CMS (PKCS#7) SignedData message.
 *
 * @packageDocumentation
 */
import forge from "node-forge";
import { WsaaCredentialsError } from "./errors.js";
import type { LoadedCredentials } from "./credentials.js";

/** The object identifiers (OIDs) that the CMS message uses. */
const OID = {
  sha1: "1.3.14.3.2.26",
  data: "1.2.840.113549.1.7.1",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
} as const;

/**
 * Signs a login ticket request XML document as a CMS (PKCS#7) SignedData message.
 *
 * @remarks
 * The message contains the XML document, its SHA1+RSA signature, and the signer certificate,
 * as the WSAA specification requires.
 *
 * @param xml - The login ticket request XML document.
 * @param credentials - A certificate and a private key that match. Use {@link loadCredentials} to get them.
 * @returns The CMS message, DER-encoded, then Base64-encoded.
 * @throws {@link WsaaCredentialsError} if the certificate or the private key cannot be used to sign.
 */
export function signLoginTicketRequest(xml: string, credentials: LoadedCredentials): string {
  let certificate: forge.pki.Certificate;
  let privateKey: forge.pki.rsa.PrivateKey;
  try {
    certificate = forge.pki.certificateFromPem(credentials.certificatePem);
  } catch {
    throw new WsaaCredentialsError("Cannot use the certificate to sign the request.");
  }
  try {
    privateKey = forge.pki.privateKeyFromPem(credentials.privateKeyPem);
  } catch {
    // Do not include the cause. It can refer to the key content.
    throw new WsaaCredentialsError("Cannot use the private key to sign the request.");
  }

  const signedData = forge.pkcs7.createSignedData();
  signedData.content = forge.util.createBuffer(Buffer.from(xml, "utf8").toString("binary"));
  signedData.addCertificate(certificate);
  signedData.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: OID.sha1,
    authenticatedAttributes: [
      { type: OID.contentType, value: OID.data },
      { type: OID.messageDigest },
      { type: OID.signingTime, value: new Date() as unknown as string },
    ],
  });
  signedData.sign();

  const der = forge.asn1.toDer(signedData.toAsn1()).getBytes();
  return Buffer.from(der, "binary").toString("base64");
}
