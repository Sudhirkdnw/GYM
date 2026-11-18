import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { HTTP_HEADERS } from "@gymos/shared-types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      startTime: number;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader =
      req.headers[HTTP_HEADERS.CORRELATION_ID] ??
      req.headers[HTTP_HEADERS.REQUEST_ID];
    const correlationId = Array.isArray(rawHeader)
      ? (rawHeader[0] ?? randomUUID())
      : rawHeader || randomUUID();

    req.correlationId = correlationId;
    req.startTime = Date.now();

    res.setHeader(HTTP_HEADERS.CORRELATION_ID, correlationId);
    res.setHeader(HTTP_HEADERS.REQUEST_ID, correlationId);

    next();
  }
}
