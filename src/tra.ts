/**
 * Builds the login ticket request (TRA) document.
 *
 * @packageDocumentation
 */
import { randomInt } from "node:crypto";

/** The largest value of an unsigned 32-bit integer. */
const MAX_UINT32 = 0xffffffff;

/** The WSAA specification limits `service` to this pattern and to 3 to 32 characters. */
const SERVICE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{2,31}$/;

/** The default time that the generation time is before the current time: 10 minutes. */
export const DEFAULT_GENERATION_OFFSET_MS = 10 * 60 * 1000;

/** The default time that the expiration time is after the current time: 10 minutes. */
export const DEFAULT_EXPIRATION_OFFSET_MS = 10 * 60 * 1000;

/** The specification accepts a generation time up to 24 hours in the past, and an expiration time up to 24 hours in the future. */
const MAX_OFFSET_MS = 24 * 60 * 60 * 1000;

/** The UTC offset of Argentina time (UTC-03:00), in minutes. */
const ARGENTINA_OFFSET_MINUTES = -180;

/**
 * Options to build a login ticket request.
 */
export interface LoginTicketRequestOptions {
  /** The current time. The default is the time of the call. */
  now?: Date;
  /** The unique identifier. The default is a random unsigned 32-bit integer. */
  uniqueId?: number;
  /** The time, in milliseconds, that the generation time is before `now`. The default is 10 minutes. */
  generationOffsetMs?: number;
  /** The time, in milliseconds, that the expiration time is after `now`. The default is 10 minutes. */
  expirationOffsetMs?: number;
}

/**
 * A login ticket request (TRA), as the WSAA specification defines it.
 */
export interface LoginTicketRequest {
  /** The target AFIP web service, for example `wsfe`. */
  service: string;
  /** An unsigned 32-bit integer. With `generationTime`, it identifies the request. */
  uniqueId: number;
  /** The time that the request was generated. */
  generationTime: Date;
  /** The time that the request expires. */
  expirationTime: Date;
  /** The `loginTicketRequest` XML document. */
  xml: string;
}

/**
 * Formats a date as an `xsd:dateTime` value in Argentina time, for example `2001-12-31T12:00:00-03:00`.
 *
 * @param date - The date to format.
 * @returns The formatted date.
 */
export function formatDateTime(date: Date): string {
  const local = new Date(date.getTime() + ARGENTINA_OFFSET_MINUTES * 60 * 1000);
  const text = local.toISOString().slice(0, 19);
  const sign = ARGENTINA_OFFSET_MINUTES < 0 ? "-" : "+";
  const abs = Math.abs(ARGENTINA_OFFSET_MINUTES);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${text}${sign}${hours}:${minutes}`;
}

function checkOffset(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_OFFSET_MS) {
    throw new RangeError(`${name} must be more than 0 and not more than 24 hours.`);
  }
}

/**
 * Builds a login ticket request (TRA) for one target AFIP web service.
 *
 * @param service - The target AFIP web service, for example `wsfe`.
 * @param options - Options to control the times and the unique identifier.
 * @returns The login ticket request and its XML document.
 * @throws RangeError if the service name, the unique identifier, or an offset is not valid.
 */
export function buildLoginTicketRequest(
  service: string,
  options: LoginTicketRequestOptions = {},
): LoginTicketRequest {
  if (!SERVICE_PATTERN.test(service)) {
    throw new RangeError(
      "The service name must start with a letter, have 3 to 32 characters, and contain only letters, digits, '-', or '_'.",
    );
  }
  const now = options.now ?? new Date();
  const generationOffsetMs = options.generationOffsetMs ?? DEFAULT_GENERATION_OFFSET_MS;
  const expirationOffsetMs = options.expirationOffsetMs ?? DEFAULT_EXPIRATION_OFFSET_MS;
  checkOffset("generationOffsetMs", generationOffsetMs);
  checkOffset("expirationOffsetMs", expirationOffsetMs);

  const uniqueId = options.uniqueId ?? randomInt(1, MAX_UINT32 + 1);
  if (!Number.isInteger(uniqueId) || uniqueId < 0 || uniqueId > MAX_UINT32) {
    throw new RangeError("uniqueId must be an unsigned 32-bit integer.");
  }

  const generationTime = new Date(now.getTime() - generationOffsetMs);
  const expirationTime = new Date(now.getTime() + expirationOffsetMs);

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0">' +
    "<header>" +
    `<uniqueId>${uniqueId}</uniqueId>` +
    `<generationTime>${formatDateTime(generationTime)}</generationTime>` +
    `<expirationTime>${formatDateTime(expirationTime)}</expirationTime>` +
    "</header>" +
    `<service>${service}</service>` +
    "</loginTicketRequest>";

  return { service, uniqueId, generationTime, expirationTime, xml };
}
