/**
 * Loads the client certificate and the private key, and checks that they match.
 *
 * @packageDocumentation
 */
import { createPrivateKey, X509Certificate, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { WsaaCredentialsError } from "./errors.js";

/**
 * The client certificate and the private key, as PEM text or as file paths.
 *
 * @remarks
 * For each item, supply the PEM text or the file path, but not both.
 * The client reads the files. It never writes a certificate or a private key to disk.
 */
export interface CredentialsConfig {
  /** The client certificate, as PEM text. */
  certificate?: string;
  /** The path to a file that contains the client certificate in PEM format. */
  certificatePath?: string;
  /** The private key, as PEM text. */
  privateKey?: string;
  /** The path to a file that contains the private key in PEM format. */
  privateKeyPath?: string;
}

/**
 * A certificate and a private key that match.
 */
export interface LoadedCredentials {
  /** The client certificate, as PEM text. */
  certificatePem: string;
  /** The private key, as PKCS#1 PEM text. */
  privateKeyPem: string;
}

function readPem(label: string, text: string | undefined, path: string | undefined): string {
  if (text !== undefined && path !== undefined) {
    throw new WsaaCredentialsError(`Supply the ${label} as PEM text or as a file path, not both.`);
  }
  if (path !== undefined) {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
      throw new WsaaCredentialsError(`Cannot read the ${label} file "${path}" (${code}).`);
    }
  }
  if (text === undefined || text.trim() === "") {
    throw new WsaaCredentialsError(`The ${label} is missing.`);
  }
  return text;
}

/**
 * Loads the certificate and the private key, and checks that they match.
 *
 * @param config - The certificate and the private key, as PEM text or as file paths.
 * @returns The certificate and the private key as PEM text.
 * @throws {@link WsaaCredentialsError} if an item is missing, unreadable, or not valid,
 *   or if the private key does not match the certificate.
 */
export function loadCredentials(config: CredentialsConfig): LoadedCredentials {
  const certificatePem = readPem("certificate", config.certificate, config.certificatePath);
  const privateKeyPem = readPem("private key", config.privateKey, config.privateKeyPath);

  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(certificatePem);
  } catch {
    throw new WsaaCredentialsError("The certificate is not a valid PEM X.509 certificate.");
  }

  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey(privateKeyPem);
  } catch {
    // Do not include the cause. It can refer to the key content.
    throw new WsaaCredentialsError("The private key is not a valid unencrypted PEM private key.");
  }
  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new WsaaCredentialsError("The private key must be an RSA key.");
  }

  if (!certificate.checkPrivateKey(privateKey)) {
    throw new WsaaCredentialsError("The private key does not match the certificate.");
  }

  // Normalize both items, so that the signer gets one known PEM format.
  return {
    certificatePem: certificate.toString(),
    privateKeyPem: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  };
}
