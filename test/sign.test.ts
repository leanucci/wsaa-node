import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import forge from "node-forge";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildLoginTicketRequest, loadCredentials, signLoginTicketRequest } from "../src/index.js";
import { createTestIdentity, type TestIdentity } from "./helpers.js";

function hasOpenssl(): boolean {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("signLoginTicketRequest", () => {
  let identity: TestIdentity;
  let dir: string;

  beforeAll(() => {
    identity = createTestIdentity("signer");
    dir = mkdtempSync(join(tmpdir(), "wsaa-sign-"));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("makes a CMS SignedData message that contains the TRA, a SHA1+RSA signature, and the certificate (AC2)", () => {
    const { xml } = buildLoginTicketRequest("wsfe");
    const cms = signLoginTicketRequest(xml, loadCredentials(identity));

    expect(cms).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const der = Buffer.from(cms, "base64").toString("binary");
    const asn1 = forge.asn1.fromDer(der);
    const message = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;

    const contentType = (asn1.value as forge.asn1.Asn1[])[0] as forge.asn1.Asn1;
    expect(forge.asn1.derToOid(forge.util.createBuffer(contentType.value as string))).toBe(forge.pki.oids.signedData);
    expect(message.certificates).toHaveLength(1);
    expect(message.certificates[0]?.subject.getField("CN")?.value).toBe("signer");
    // The message includes the TRA itself (an attached signature).
    expect(Buffer.from(cms, "base64").includes(Buffer.from(xml, "utf8"))).toBe(true);
    // The digest algorithm is SHA1.
    expect(forge.asn1.derToOid(forge.util.createBuffer(asn1ToDigestOid(asn1)))).toBe(forge.pki.oids.sha1);
  });

  it.skipIf(!hasOpenssl())("makes a message with a signature that OpenSSL verifies (AC2)", () => {
    const { xml } = buildLoginTicketRequest("wsfe");
    const cms = signLoginTicketRequest(xml, loadCredentials(identity));
    const cmsPath = join(dir, "tra.cms");
    writeFileSync(cmsPath, Buffer.from(cms, "base64"));

    const output = execFileSync("openssl", [
      "cms",
      "-verify",
      "-noverify",
      "-binary",
      "-inform",
      "DER",
      "-in",
      cmsPath,
    ], { stdio: "pipe" });
    expect(output.toString("utf8")).toBe(xml);
  });

  it.skipIf(!hasOpenssl())("makes a message that OpenSSL rejects when the content changes", () => {
    const { xml } = buildLoginTicketRequest("wsfe", { uniqueId: 1 });
    const cms = Buffer.from(signLoginTicketRequest(xml, loadCredentials(identity)), "base64");
    const index = cms.indexOf(Buffer.from("<uniqueId>1<"));
    expect(index).toBeGreaterThan(0);
    cms[index + "<uniqueId>".length] = "2".charCodeAt(0);
    const cmsPath = join(dir, "tampered.cms");
    writeFileSync(cmsPath, cms);

    expect(() =>
      execFileSync("openssl", ["cms", "-verify", "-noverify", "-binary", "-inform", "DER", "-in", cmsPath], {
        stdio: "pipe",
      }),
    ).toThrow();
  });
});

/**
 * Gets the DER bytes of the first digest algorithm OID in a SignedData ASN.1 structure.
 */
function asn1ToDigestOid(contentInfo: forge.asn1.Asn1): string {
  const explicit = (contentInfo.value as forge.asn1.Asn1[])[1] as forge.asn1.Asn1;
  const signedData = (explicit.value as forge.asn1.Asn1[])[0] as forge.asn1.Asn1;
  const digestAlgorithms = (signedData.value as forge.asn1.Asn1[])[1] as forge.asn1.Asn1;
  const algorithm = (digestAlgorithms.value as forge.asn1.Asn1[])[0] as forge.asn1.Asn1;
  const oid = (algorithm.value as forge.asn1.Asn1[])[0] as forge.asn1.Asn1;
  return oid.value as string;
}
