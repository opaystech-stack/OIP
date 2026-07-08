import type { DocumentAdapter, OcrAdapter } from "../../adapters/src/index.js";

export class PlainTextDocumentAdapter implements DocumentAdapter {
  async parse(input: { readonly name: string; readonly bytes: Uint8Array; readonly mimeType: string }) {
    if (!input.mimeType.startsWith("text/")) {
      throw new Error(`PlainTextDocumentAdapter only supports text/* mime types. Received: ${input.mimeType}`);
    }

    return {
      text: new TextDecoder().decode(input.bytes),
      metadata: {
        name: input.name,
        mimeType: input.mimeType,
      },
    };
  }
}

export class MockOcrAdapter implements OcrAdapter {
  constructor(private readonly text: string) {}

  async extractText(_input: { readonly bytes: Uint8Array; readonly mimeType: string }): Promise<string> {
    return this.text;
  }
}
