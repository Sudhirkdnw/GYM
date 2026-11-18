import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    name: z.string().min(3),
    age: z.number().positive(),
  });

  const pipe = new ZodValidationPipe(schema);

  it("should pass valid data through without mutation", () => {
    const input = { name: "Titan Gym", age: 5 };
    const result = pipe.transform(input);
    expect(result).toEqual(input);
  });

  it("should throw BadRequestException on invalid data", () => {
    const invalidInput = { name: "A", age: -1 };
    expect(() => pipe.transform(invalidInput)).toThrow(BadRequestException);
  });
});
