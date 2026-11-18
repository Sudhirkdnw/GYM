import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`,
        );
        throw new BadRequestException({
          message: formatted,
          error: "Validation Failed",
        });
      }
      throw new BadRequestException("Validation failed");
    }
  }
}
