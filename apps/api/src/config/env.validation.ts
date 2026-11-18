import { apiEnvSchema, ApiEnv } from "@gymos/validation";

export function validateEnvironment(config: Record<string, unknown>): ApiEnv {
  const result = apiEnvSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors.map(
      (err) => `  - ${err.path.join(".")}: ${err.message}`,
    );
    throw new Error(
      `GymOS API Environment Configuration Validation Error:\n${errors.join("\n")}`,
    );
  }

  return result.data;
}
