import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { buildLoginTicketRequest, formatDateTime } from "../src/index.js";

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildLoginTicketRequest", () => {
  it("builds a TRA with a unique identifier, a generation time, and an expiration time (AC1)", () => {
    const now = new Date("2026-11-24T15:00:00Z");
    const request = buildLoginTicketRequest("wsfe", { now });

    expect(Number.isInteger(request.uniqueId)).toBe(true);
    expect(request.uniqueId).toBeGreaterThanOrEqual(0);
    expect(request.uniqueId).toBeLessThanOrEqual(0xffffffff);

    // The generation time is before the request, but not more than 24 hours before.
    expect(request.generationTime.getTime()).toBeLessThan(now.getTime());
    expect(now.getTime() - request.generationTime.getTime()).toBeLessThanOrEqual(DAY_MS);
    // The expiration time is after the request, but not more than 24 hours after.
    expect(request.expirationTime.getTime()).toBeGreaterThan(now.getTime());
    expect(request.expirationTime.getTime() - now.getTime()).toBeLessThanOrEqual(DAY_MS);

    const doc = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(request.xml);
    const ticket = doc.loginTicketRequest;
    expect(ticket["@_version"]).toBe("1.0");
    expect(ticket.service).toBe("wsfe");
    expect(ticket.header.uniqueId).toBe(String(request.uniqueId));
    expect(ticket.header.generationTime).toMatch(DATE_TIME);
    expect(ticket.header.expirationTime).toMatch(DATE_TIME);
    expect(new Date(ticket.header.generationTime).getTime()).toBe(request.generationTime.getTime());
    expect(new Date(ticket.header.expirationTime).getTime()).toBe(request.expirationTime.getTime());
  });

  it("uses a different unique identifier for each request (AC1)", () => {
    const ids = new Set(Array.from({ length: 50 }, () => buildLoginTicketRequest("wsfe").uniqueId));
    expect(ids.size).toBe(50);
  });

  it("puts the header elements in the order of the schema", () => {
    const { xml } = buildLoginTicketRequest("wsfe", { uniqueId: 4325399 });
    expect(xml).toMatch(
      /^<\?xml version="1.0" encoding="UTF-8"\?><loginTicketRequest version="1.0"><header><uniqueId>4325399<\/uniqueId><generationTime>[^<]+<\/generationTime><expirationTime>[^<]+<\/expirationTime><\/header><service>wsfe<\/service><\/loginTicketRequest>$/,
    );
  });

  it("accepts custom offsets up to 24 hours", () => {
    const now = new Date("2026-11-24T15:00:00Z");
    const request = buildLoginTicketRequest("wsfe", { now, generationOffsetMs: 1000, expirationOffsetMs: DAY_MS });
    expect(request.generationTime.toISOString()).toBe("2026-11-24T14:59:59.000Z");
    expect(request.expirationTime.toISOString()).toBe("2026-11-25T15:00:00.000Z");
  });

  it.each([0, -1, DAY_MS + 1, Number.NaN])("rejects the offset %s", (offset) => {
    expect(() => buildLoginTicketRequest("wsfe", { expirationOffsetMs: offset })).toThrow(RangeError);
    expect(() => buildLoginTicketRequest("wsfe", { generationOffsetMs: offset })).toThrow(RangeError);
  });

  it.each(["", "ws", "1wsfe", "ws fe", "ws<fe>", "a".repeat(33)])("rejects the service name %j", (service) => {
    expect(() => buildLoginTicketRequest(service)).toThrow(RangeError);
  });

  it.each(["wsfe", "ws_sr_padron_a5", "wsfex-v1", "a".repeat(32)])("accepts the service name %j", (service) => {
    expect(buildLoginTicketRequest(service).service).toBe(service);
  });

  it.each([-1, 0x100000000, 1.5])("rejects the unique identifier %s", (uniqueId) => {
    expect(() => buildLoginTicketRequest("wsfe", { uniqueId })).toThrow(RangeError);
  });
});

describe("formatDateTime", () => {
  it("formats a date in Argentina time", () => {
    expect(formatDateTime(new Date("2001-12-31T15:00:00Z"))).toBe("2001-12-31T12:00:00-03:00");
    expect(formatDateTime(new Date("2002-01-01T01:30:05.999Z"))).toBe("2001-12-31T22:30:05-03:00");
  });
});
