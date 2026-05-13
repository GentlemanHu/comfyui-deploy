import type { WorkflowVersionType } from "@/db/schema";
import { getInputsFromWorkflow } from "@/lib/getInputsFromWorkflow";
import { z } from "zod";

export function workflowVersionInputsToZod(
  workflow_version: WorkflowVersionType
) {
  const inputs = getInputsFromWorkflow(workflow_version);
  return plainInputsToZod(inputs);
}

export function plainInputsToZod(
  inputs: ReturnType<typeof getInputsFromWorkflow>
) {
  if (!inputs) return null;

  return z.object({
    ...Object.fromEntries(
      inputs?.map((x) => {
        if (!x) return ["", z.string().optional()];

        const label = x.display_name || x.input_id;
        let schema: z.ZodTypeAny;

        if (x.value_type === "boolean") {
          schema = z.boolean();
          if (typeof x.default_value === "boolean") {
            schema = schema.default(x.default_value);
          }
        } else if (x.value_type === "number" || x.value_type === "integer") {
          let numberSchema = z.coerce.number();
          if (x.value_type === "integer") numberSchema = numberSchema.int();
          if (x.min_value !== undefined) {
            numberSchema = numberSchema.min(x.min_value);
          }
          if (x.max_value !== undefined) {
            numberSchema = numberSchema.max(x.max_value);
          }
          schema = numberSchema;
          if (typeof x.default_value === "number") {
            schema = schema.default(x.default_value);
          }
        } else if (
          x.value_type === "enum" &&
          x.options &&
          x.options.length > 0
        ) {
          schema = z.enum(x.options as [string, ...string[]]);
          if (
            typeof x.default_value === "string" &&
            x.options.includes(x.default_value)
          ) {
            schema = schema.default(x.default_value);
          }
        } else {
          schema = z.string();
          if (x.default_value !== undefined) {
            schema = schema.default(String(x.default_value));
          }
        }

        return [x.input_id, schema.optional().describe(label)];
      })
    ),
  });
}
