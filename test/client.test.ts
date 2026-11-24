import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  WSAA_ENDPOINTS,
  WsaaClient,
  WsaaCredentialsError,
  WsaaResponseError,
  WsaaSoapFaultError,
  type WsaaClientConfig,
} from "../src/index.js";
import { createTestIdentity, faultResponse, successResponse, type TestIdentity } from "./helpers.js";

const TOKEN = "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8c3NvIHZlcnNpb249IjIuMCI+";
const SIGN = "a6QSSZBgLf0TTcktSNteeSg3qXsMVjo/F5py/Gtw7xucTrUWbsrVCdIoGE8Cm1bixpuVPlr58k6n";
const NOW = new Date("2026-11-24T15:00:00Z");

function okBody(): string {
  return successResponse({
    token: TOKEN,
    sign: SIGN,
    generationTime: "2026-11-24T11:59:02.123-03:00",
    expirationTime: "2026-11-24T23:59:02.123-03:00",
  });
}

function mockFetch(body: string, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status, headers: { "Content-Type": "text/xml" } }));
}

describe("WsaaClient", () => {
  let identity: TestIdentity;
  let other: TestIdentity;

  beforeAll(() => {
    identity = createTestIdentity("client");
    other = createTestIdentity("other");
  });

  function config(overrides: Partial<WsaaClientConfig> = {}): WsaaClientConfig {
    return { environment: "testing", ...identity, fetch: mockFetch(okBody()), ...overrides };
  }

  it("uses the endpoint URLs that the WSAA specification names", () => {
    expect(WSAA_ENDPOINTS.testing).toBe("https://wsaahomo.afip.gov.ar/ws/services/LoginCms");
    expect(WSAA_ENDPOINTS.production).toBe("https://wsaa.afip.gov.ar/ws/services/LoginCms");
  });

  it("sends the signed request to the testing endpoint (AC3)", async () => {
    const fetch = mockFetch(okBody());
    await new WsaaClient(config({ environment: "testing", fetch })).login("wsfe", { now: NOW });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://wsaahomo.afip.gov.ar/ws/services/LoginCms");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' });
    const body = String(init?.body);
    expect(body).toContain('xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"');
    expect(body).toMatch(/<wsaa:loginCms><wsaa:in0>[A-Za-z0-9+/]+=*<\/wsaa:in0><\/wsaa:loginCms>/);
  });

  it("sends the signed request to the production endpoint (AC4)", async () => {
    const fetch = mockFetch(okBody());
    await new WsaaClient(config({ environment: "production", fetch })).login("wsfe", { now: NOW });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe("https://wsaa.afip.gov.ar/ws/services/LoginCms");
  });

  it("rejects an unknown environment", () => {
    expect(() => new WsaaClient(config({ environment: "staging" as never }))).toThrow(RangeError);
    expect(() => new WsaaClient(config({ environment: "toString" as never }))).toThrow(RangeError);
  });

  it("returns the TOKEN, the SIGN, and the expiration time (AC5)", async () => {
    const ticket = await new WsaaClient(config()).login("wsfe", { now: NOW });

    expect(ticket.token).toBe(TOKEN);
    expect(ticket.sign).toBe(SIGN);
    expect(ticket.expirationTime.toISOString()).toBe("2026-11-25T02:59:02.123Z");
    expect(ticket.generationTime.toISOString()).toBe("2026-11-24T14:59:02.123Z");
  });

  it("raises an error with the fault message when WSAA returns a SOAP fault (AC6)", async () => {
    const message = "El CEE ya posee un TA valido para el acceso al WSN solicitado";
    const fetch = mockFetch(faultResponse("coe.alreadyAuthenticated", message), 500);
    const promise = new WsaaClient(config({ fetch })).login("wsfe", { now: NOW });

    await expect(promise).rejects.toBeInstanceOf(WsaaSoapFaultError);
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.toMatchObject({ faultCode: "ns1:coe.alreadyAuthenticated", faultString: message });
  });

  it("raises an error with the fault message when the fault has HTTP status 200 (AC6)", async () => {
    const fetch = mockFetch(faultResponse("cms.cert.untrusted", "Certificado no emitido por AC de confianza"));
    await expect(new WsaaClient(config({ fetch })).login("wsfe")).rejects.toThrow(
      /cms\.cert\.untrusted.*Certificado no emitido por AC de confianza/,
    );
  });

  it.each([
    ["the certificate is missing", { certificate: undefined }],
    ["the private key is missing", { privateKey: undefined }],
    ["the certificate file does not exist", { certificate: undefined, certificatePath: "/no/such/cert.pem" }],
    ["the private key file does not exist", { privateKey: undefined, privateKeyPath: "/no/such/key.pem" }],
    ["the private key is not valid", { privateKey: "garbage" }],
  ])("raises an error and makes no call to WSAA when %s (AC7)", async (_name, overrides) => {
    const fetch = mockFetch(okBody());
    await expect(new WsaaClient(config({ ...overrides, fetch })).login("wsfe")).rejects.toBeInstanceOf(
      WsaaCredentialsError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("raises an error and makes no call to WSAA when the certificate and the key do not match (AC8)", async () => {
    const fetch = mockFetch(okBody());
    const promise = new WsaaClient(config({ privateKey: other.privateKey, fetch })).login("wsfe");
    await expect(promise).rejects.toBeInstanceOf(WsaaCredentialsError);
    await expect(promise).rejects.toThrow(/does not match/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("raises an error without the response body for an HTTP error without a fault", async () => {
    const fetch = mockFetch(`<html>${TOKEN}</html>`, 503);
    const promise = new WsaaClient(config({ fetch })).login("wsfe");
    await expect(promise).rejects.toBeInstanceOf(WsaaResponseError);
    await expect(promise).rejects.toThrow("WSAA returned HTTP status 503.");
  });

  it("raises an error when the HTTP request fails", async () => {
    const failingFetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(new WsaaClient(config({ fetch: failingFetch })).login("wsfe")).rejects.toThrow(
      /Cannot call WSAA at https:\/\/wsaahomo.*fetch failed/,
    );
  });

  it("raises an error when the access ticket is expired", async () => {
    const promise = new WsaaClient(config()).login("wsfe", { now: new Date("2026-11-25T03:00:00Z") });
    await expect(promise).rejects.toThrow("The access ticket is expired.");
  });

  it.each([
    ["no loginCmsReturn", "<soapenv:Envelope xmlns:soapenv=\"x\"><soapenv:Body/></soapenv:Envelope>", /loginCmsReturn/],
    [
      "no SIGN",
      okBody().replace(/&lt;sign&gt;.*&lt;\/sign&gt;/, ""),
      /no TOKEN or no SIGN/,
    ],
    ["a bad date", okBody().replace("2026-11-24T23:59:02.123-03:00", "tomorrow"), /expirationTime/],
  ])("raises an error when the response has %s", async (_name, body, message) => {
    const promise = new WsaaClient(config({ fetch: mockFetch(body) })).login("wsfe", { now: NOW });
    await expect(promise).rejects.toBeInstanceOf(WsaaResponseError);
    await expect(promise).rejects.toThrow(message);
  });

  it("does not put the TOKEN, the SIGN, or the private key in an error message", async () => {
    const bodies = [
      okBody().replace(/&lt;sign&gt;.*&lt;\/sign&gt;/, ""),
      okBody(),
      `<html>${TOKEN}${SIGN}</html>`,
    ];
    for (const body of bodies) {
      const error = await new WsaaClient(config({ fetch: mockFetch(body, 500) }))
        .login("wsfe", { now: new Date("2030-01-01T00:00:00Z") })
        .catch((e: unknown) => e as Error);
      expect(error).toBeInstanceOf(Error);
      const text = `${(error as Error).message} ${(error as Error).stack}`;
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(SIGN);
      expect(text).not.toContain("PRIVATE KEY");
    }
  });

  it("does not log anything", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await new WsaaClient(config()).login("wsfe", { now: NOW });
    await new WsaaClient(config({ privateKey: other.privateKey })).login("wsfe").catch(() => undefined);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
