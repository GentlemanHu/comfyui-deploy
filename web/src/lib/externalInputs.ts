import { customInputNodes } from "@/components/customInputNodes";

export type ExternalInputValue = string | number | boolean;

export type ExternalInputDefinition = {
  class_type: string;
  input_id: string;
  default_value?: ExternalInputValue;
  display_name?: string;
  description?: string;
  value_type: "string" | "number" | "integer" | "boolean" | "enum";
  options?: string[];
  min_value?: number;
  max_value?: number;
};

const numberInputTypes = new Set([
  "ComfyUIDeployExternalNumber",
  "ComfyUIDeployExternalNumberInt",
  "ComfyUIDeployExternalNumberSlider",
  "ComfyUIDeployExternalNumberSliderInt",
  "ComfyUIDeployExternalSeed",
]);

const integerInputTypes = new Set([
  "ComfyUIDeployExternalNumberInt",
  "ComfyUIDeployExternalNumberSliderInt",
  "ComfyUIDeployExternalSeed",
]);

const defaultValueInputTypes = new Set([
  "ComfyUIDeployExternalText",
  "ComfyUIDeployExternalTextAny",
  "ComfyUIDeployExternalCheckpoint",
  "ComfyUIDeployExternalEnum",
  "ComfyUIDeployExternalBoolean",
  "ComfyUIDeployExternalNumber",
  "ComfyUIDeployExternalNumberInt",
  "ComfyUIDeployExternalNumberSlider",
  "ComfyUIDeployExternalNumberSliderInt",
  "ComfyUIDeployExternalSeed",
]);

export function getExternalInputDefinition(node: any) {
  if (!node?.class_type || !isExternalInputNode(node.class_type)) {
    return undefined;
  }

  const inputs = node.inputs ?? {};
  const inputId = inputs.input_id;
  if (typeof inputId !== "string" || inputId.length === 0) return undefined;

  return {
    class_type: node.class_type,
    input_id: inputId,
    default_value: normalizeExternalInputValue(
      node.class_type,
      inputs.default_value
    ),
    display_name: stringOrUndefined(inputs.display_name),
    description: stringOrUndefined(inputs.description),
    value_type: getExternalInputValueType(node.class_type),
    options: parseExternalEnumOptions(inputs.options, inputs.default_value),
    min_value: numberOrUndefined(inputs.min_value),
    max_value: numberOrUndefined(inputs.max_value),
  } satisfies ExternalInputDefinition;
}

export function getExternalInputDisplayType(classType: string) {
  return customInputNodes[classType] ?? getExternalInputValueType(classType);
}

function isExternalInputNode(classType: string) {
  return (
    customInputNodes[classType] !== undefined ||
    classType.startsWith("ComfyUIDeployExternal")
  );
}

export function applyExternalInputsToWorkflow(
  workflowApi: any,
  inputs?: Record<string, ExternalInputValue>
) {
  if (!workflowApi || !inputs) return workflowApi;

  for (const node of Object.values(workflowApi) as any[]) {
    const definition = getExternalInputDefinition(node);
    if (!definition || !(definition.input_id in inputs)) continue;

    const nextValue = coerceExternalInputValue(
      node.class_type,
      inputs[definition.input_id]
    );

    node.inputs.input_id = nextValue;

    if (defaultValueInputTypes.has(node.class_type)) {
      node.inputs.default_value = nextValue;
    }

    switch (node.class_type) {
      case "ComfyUIDeployExternalImageBatch":
        node.inputs.images = nextValue;
        break;
      case "ComfyUIDeployExternalLora":
        node.inputs.lora_url = nextValue;
        break;
      case "ComfyUIDeployExternalFaceModel":
        node.inputs.face_model_url = nextValue;
        break;
      case "ComfyUIDeployExternalAudio":
        node.inputs.audio_file = nextValue;
        break;
      case "ComfyUIDeployExternalEXR":
        node.inputs.exr_file = nextValue;
        break;
      case "ComfyUIDeployExternalFile":
        node.inputs.file_url = nextValue;
        break;
    }
  }

  return workflowApi;
}

function getExternalInputValueType(classType: string) {
  if (classType === "ComfyUIDeployExternalBoolean") return "boolean";
  if (classType === "ComfyUIDeployExternalEnum") return "enum";
  if (integerInputTypes.has(classType)) return "integer";
  if (numberInputTypes.has(classType)) return "number";
  return "string";
}

function normalizeExternalInputValue(classType: string, value: any) {
  if (value === undefined || value === null) return undefined;
  return coerceExternalInputValue(classType, value);
}

function coerceExternalInputValue(classType: string, value: ExternalInputValue) {
  if (classType === "ComfyUIDeployExternalBoolean") {
    if (typeof value === "boolean") return value;
    return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
  }

  if (numberInputTypes.has(classType)) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return value;
    return integerInputTypes.has(classType)
      ? Math.round(numberValue)
      : numberValue;
  }

  return String(value);
}

function parseExternalEnumOptions(rawOptions: any, fallbackValue: any) {
  if (!rawOptions || !String(rawOptions).trim()) {
    return fallbackValue ? [String(fallbackValue)] : undefined;
  }

  const raw = String(rawOptions).trim();

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Also support plain multiline options from the ComfyUI plugin.
  }

  const separator = raw.includes("\n") ? /\r?\n/ : ",";
  const options = raw
    .split(separator)
    .map((option) => option.trim())
    .filter(Boolean);

  return options.length > 0 ? options : undefined;
}

function stringOrUndefined(value: any) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrUndefined(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
