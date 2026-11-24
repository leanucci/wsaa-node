import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadCredentials, WsaaCredentialsError } from "../src/index.js";
import { createTestIdentity, type TestIdentity } from "./helpers.js";

describe("loadCredentials", () => {
  let identity: TestIdentity;
  let other: TestIdentity;
  let dir: string;

  beforeAll(() => {
    identity = createTestIdentity("one");
    other = createTestIdentity("two");
    dir = mkdtempSync(join(tmpdir(), "wsaa-cred-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads the certificate and the private key from PEM text", () => {
    const loaded = loadCredentials(identity);
    expect(loaded.certificatePem).toContain("-----BEGIN CERTIFICATE-----");
    expect(loaded.privateKeyPem).toContain("-----BEGIN RSA PRIVATE KEY-----");
  });

  it("loads the certificate and the private key from file paths", () => {
    const certificatePath = join(dir, "cert.pem");
    const privateKeyPath = join(dir, "key.pem");
    writeFileSync(certificatePath, identity.certificate);
    writeFileSync(privateKeyPath, identity.privateKey);
    const loaded = loadCredentials({ certificatePath, privateKeyPath });
    expect(loaded.certificatePem).toContain("-----BEGIN CERTIFICATE-----");
  });

  it.each([
    [{ privateKey: "x" }, /certificate is missing/],
    [{ certificate: "x" }, /private key is missing/],
    [{ certificate: "  ", privateKey: "x" }, /certificate is missing/],
  ])("raises an error when an item is missing (AC7)", (config, message) => {
    expect(() => loadCredentials(config)).toThrow(WsaaCredentialsError);
    expect(() => loadCredentials(config)).toThrow(message);
  });

  it("raises an error when a file does not exist (AC7)", () => {
    const config = { certificatePath: join(dir, "missing.pem"), privateKey: identity.privateKey };
    expect(() => loadCredentials(config)).toThrow(WsaaCredentialsError);
    expect(() => loadCredentials(config)).toThrow(/Cannot read the certificate file .*ENOENT/);
  });

  it.skipIf(process.getuid?.() === 0)("raises an error when a file is unreadable (AC7)", () => {
    const privateKeyPath = join(dir, "locked.pem");
    writeFileSync(privateKeyPath, identity.privateKey);
    chmodSync(privateKeyPath, 0o000);
    const config = { certificate: identity.certificate, privateKeyPath };
    expect(() => loadCredentials(config)).toThrow(/Cannot read the private key file .*EACCES/);
  });

  it("raises an error when the PEM text is not valid (AC7)", () => {
    expect(() => loadCredentials({ certificate: "not a cert", privateKey: identity.privateKey })).toThrow(
      /certificate is not a valid/,
    );
    expect(() => loadCredentials({ certificate: identity.certificate, privateKey: "not a key" })).toThrow(
      /private key is not a valid/,
    );
  });

  it("raises an error when both PEM text and a path are given", () => {
    expect(() =>
      loadCredentials({ certificate: identity.certificate, certificatePath: "x", privateKey: identity.privateKey }),
    ).toThrow(/not both/);
  });

  it("raises an error when the certificate and the private key do not match (AC8)", () => {
    const config = { certificate: identity.certificate, privateKey: other.privateKey };
    expect(() => loadCredentials(config)).toThrow(WsaaCredentialsError);
    expect(() => loadCredentials(config)).toThrow(/does not match/);
  });

  it("does not put the private key in an error message", () => {
    const corrupt = identity.privateKey.replace(/[A-Z]{8}/, "########");
    for (const config of [
      { certificate: identity.certificate, privateKey: corrupt },
      { certificate: identity.certificate, privateKey: other.privateKey },
    ]) {
      try {
        loadCredentials(config);
        expect.unreachable();
      } catch (error) {
        const text = `${(error as Error).message}\n${(error as Error).stack}\n${String((error as Error).cause)}`;
        expect(text).not.toContain("PRIVATE KEY");
        expect(text).not.toContain(config.privateKey.split("\n")[1]);
      }
    }
  });
});
