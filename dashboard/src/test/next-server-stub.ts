/**
 * Minimal Next.js server stubs for Vitest in the bot package (dashboard route tests).
 * Avoids resolving the real `next/server` module when importing App Router handlers.
 */
export class NextRequest extends Request {
  get nextUrl(): URL {
    return new URL(this.url);
  }
}

export class NextResponse extends Response {}
