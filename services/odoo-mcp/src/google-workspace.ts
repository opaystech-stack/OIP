import type { JsonObject, JsonValue } from "@opaystech/oip";

export const GOOGLE_WORKSPACE_SCOPES = Object.freeze([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
]);

export type GoogleWorkspaceCapabilityId =
  | "google.calendar.event.create"
  | "google.calendar.events.read"
  | "google.gmail.send"
  | "google.gmail.read"
  | "google.drive.docs.read"
  | "google.sheets.update";

export interface GoogleWorkspaceConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

export interface GoogleWorkspaceExecutor {
  execute(capabilityId: GoogleWorkspaceCapabilityId, args: JsonObject): Promise<JsonObject>;
}

export class GoogleWorkspaceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GoogleWorkspaceError";
  }
}

interface OAuthToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

export function createGoogleWorkspaceClient(config: GoogleWorkspaceConfig): GoogleWorkspaceExecutor {
  let cachedToken: OAuthToken | undefined;

  return {
    async execute(capabilityId, args): Promise<JsonObject> {
      const accessToken = await getAccessToken(config, cachedToken);
      const tokenResponse = await getTokenResponseIfExpired(config, cachedToken, accessToken);
      cachedToken = tokenResponse;

      switch (capabilityId) {
        case "google.calendar.event.create":
          return createCalendarEvent(accessToken, args);
        case "google.calendar.events.read":
          return readCalendarEvents(accessToken, args);
        case "google.gmail.send":
          return sendGmail(accessToken, args);
        case "google.gmail.read":
          return readGmail(accessToken, args);
        case "google.drive.docs.read":
          return readGoogleDoc(accessToken, args);
        case "google.sheets.update":
          return updateGoogleSheet(accessToken, args);
      }
    },
  };

  async function getTokenResponseIfExpired(
    oauthConfig: GoogleWorkspaceConfig,
    previous: OAuthToken | undefined,
    accessToken: string,
  ): Promise<OAuthToken> {
    if (previous !== undefined && previous.accessToken === accessToken) return previous;
    return { accessToken, expiresAt: Date.now() + 3_000_000 };
  }
}

async function getAccessToken(config: GoogleWorkspaceConfig, cached: OAuthToken | undefined): Promise<string> {
  if (cached !== undefined && cached.expiresAt > Date.now()) return cached.accessToken;

  let response: JsonObject;
  try {
    response = await requestJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
  } catch {
    throw new GoogleWorkspaceError("oauth_refresh_failed");
  }

  const accessToken = response.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new GoogleWorkspaceError("oauth_access_token_missing");
  }
  return accessToken;
}

async function createCalendarEvent(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const calendarId = stringArg(args.calendarId, "primary");
  const summary = requiredString(args.summary);
  const start = requiredString(args.start);
  const end = requiredString(args.end);
  const timeZone = optionalString(args.timeZone);
  const description = optionalString(args.description);
  const location = optionalString(args.location);
  const startValue = {
    dateTime: start,
    ...(timeZone === undefined ? {} : { timeZone }),
  } as JsonObject;
  const endValue = {
    dateTime: end,
    ...(timeZone === undefined ? {} : { timeZone }),
  } as JsonObject;
  const event = {
    summary,
    start: startValue,
    end: endValue,
    ...(description === undefined ? {} : { description }),
    ...(location === undefined ? {} : { location }),
    ...(Array.isArray(args.attendees) ? { attendees: args.attendees as JsonValue } : {}),
  } as JsonObject;
  const result = await requestGoogleJson(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(event) },
  );
  return {
    status: "created",
    ...(typeof result.id === "string" ? { id: result.id } : {}),
    ...(typeof result.htmlLink === "string" ? { htmlLink: result.htmlLink } : {}),
    summary,
  };
}

async function readCalendarEvents(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const calendarId = stringArg(args.calendarId, "primary");
  const maxResults = boundedMaxResults(args.maxResults);
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
    ...(optionalString(args.timeMin) ? { timeMin: optionalString(args.timeMin)! } : {}),
    ...(optionalString(args.timeMax) ? { timeMax: optionalString(args.timeMax)! } : {}),
  });
  const result = await requestGoogleJson(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
  return {
    events: Array.isArray(result.items) ? result.items as JsonValue : [],
    resultSizeEstimate: typeof result.items === "object" && Array.isArray(result.items) ? result.items.length : 0,
  };
}

async function sendGmail(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const to = requiredString(args.to);
  const subject = requiredString(args.subject);
  const body = requiredString(args.body);
  const contentType = args.html === true ? "text/html" : "text/plain";
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: ${contentType}; charset=UTF-8`,
    "",
    body,
  ].join("\r\n");
  const result = await requestGoogleJson(accessToken, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url") }),
  });
  return {
    status: "sent",
    ...(typeof result.id === "string" ? { id: result.id } : {}),
    ...(typeof result.threadId === "string" ? { threadId: result.threadId } : {}),
  };
}

async function readGmail(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const maxResults = boundedMaxResults(args.maxResults);
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    ...(optionalString(args.query) ? { q: optionalString(args.query)! } : {}),
  });
  const list = await requestGoogleJson(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`);
  const messageRefs = Array.isArray(list.messages) ? list.messages.filter(isJsonObject).slice(0, maxResults) : [];
  const messages = await Promise.all(messageRefs.map(async (message) => {
    if (typeof message.id !== "string") return {};
    const detail = await requestGoogleJson(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    return {
      ...(typeof detail.id === "string" ? { id: detail.id } : {}),
      ...(typeof detail.threadId === "string" ? { threadId: detail.threadId } : {}),
      ...(typeof detail.snippet === "string" ? { snippet: detail.snippet } : {}),
      ...(isJsonObject(detail.payload) ? { headers: headersFromPayload(detail.payload) } : {}),
    };
  }));
  return { messages: messages as JsonValue, resultSizeEstimate: messages.length };
}

async function readGoogleDoc(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const documentId = requiredString(args.documentId);
  const maxChars = boundedMaxChars(args.maxChars);
  const result = await requestGoogleJson(accessToken, `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`);
  const fullText = extractDocumentText(result);
  return {
    documentId,
    ...(typeof result.title === "string" ? { title: result.title } : {}),
    text: fullText.slice(0, maxChars),
    truncated: fullText.length > maxChars,
  };
}

async function updateGoogleSheet(accessToken: string, args: JsonObject): Promise<JsonObject> {
  const spreadsheetId = requiredString(args.spreadsheetId);
  const range = requiredString(args.range);
  if (!Array.isArray(args.values)) throw new GoogleWorkspaceError("invalid_values");
  const valueInputOption = stringArg(args.valueInputOption, "USER_ENTERED");
  const params = new URLSearchParams({ valueInputOption });
  const result = await requestGoogleJson(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params.toString()}`,
    { method: "PUT", body: JSON.stringify({ range, majorDimension: "ROWS", values: args.values }) },
  );
  return {
    status: "updated",
    ...(typeof result.updatedRange === "string" ? { updatedRange: result.updatedRange } : {}),
    ...(typeof result.updatedRows === "number" ? { updatedRows: result.updatedRows } : {}),
    ...(typeof result.updatedColumns === "number" ? { updatedColumns: result.updatedColumns } : {}),
    ...(typeof result.updatedCells === "number" ? { updatedCells: result.updatedCells } : {}),
  };
}

async function requestGoogleJson(accessToken: string, url: string, init: RequestInit = {}): Promise<JsonObject> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok || !isJsonObject(body)) throw new GoogleWorkspaceError(`api_http_${response.status}`);
  return body;
}

async function requestJson(url: string, init: RequestInit): Promise<JsonObject> {
  const response = await fetch(url, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok || !isJsonObject(body)) throw new GoogleWorkspaceError(`oauth_http_${response.status}`);
  return body;
}

function headersFromPayload(payload: JsonObject): JsonValue {
  if (!Array.isArray(payload.headers)) return [];
  return payload.headers
    .filter(isJsonObject)
    .filter((header) => typeof header.name === "string" && typeof header.value === "string")
    .map((header) => ({ name: header.name as string, value: header.value as string })) as JsonValue;
}

function extractDocumentText(document: JsonObject): string {
  const chunks: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!isJsonObject(value)) return;
    if (typeof value.textRun === "object" && value.textRun !== null && !Array.isArray(value.textRun)) {
      const content = (value.textRun as JsonObject).content;
      if (typeof content === "string") chunks.push(content);
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(document.body);
  return chunks.join("");
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: JsonValue | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new GoogleWorkspaceError("invalid_string");
  return value.trim();
}

function optionalString(value: JsonValue | undefined): string | undefined {
  return value === undefined ? undefined : requiredString(value);
}

function stringArg(value: JsonValue | undefined, fallback?: string): string {
  return value === undefined && fallback !== undefined ? fallback : requiredString(value);
}

function boundedMaxResults(value: JsonValue | undefined): number {
  if (value === undefined) return 20;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new GoogleWorkspaceError("invalid_max_results");
  }
  return value;
}

function boundedMaxChars(value: JsonValue | undefined): number {
  if (value === undefined) return 20_000;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new GoogleWorkspaceError("invalid_max_chars");
  }
  return value;
}