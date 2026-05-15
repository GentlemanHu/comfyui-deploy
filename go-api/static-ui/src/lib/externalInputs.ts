export type ExternalInputDefinition = {
  input_id: string;
  default_value?: string | number | boolean;
  display_name?: string;
  value_type: "string" | "number" | "integer" | "boolean" | "enum" | "file";
  accept?: string;
  options?: string[];
};

export function getInputsFromWorkflow(workflowApi?: Record<string, any>): ExternalInputDefinition[] {
  if (!workflowApi) return [];
  return Object.values(workflowApi)
    .map((node: any) => getExternalInputDefinition(node))
    .filter(Boolean) as ExternalInputDefinition[];
}

function getExternalInputDefinition(node: any): ExternalInputDefinition | undefined {
  if (!node?.class_type || !String(node.class_type).startsWith("ComfyUIDeployExternal")) return undefined;
  const inputs = node.inputs ?? {};
  const inputId = inputs.input_id;
  if (typeof inputId !== "string" || inputId.length === 0) return undefined;
  const classType = String(node.class_type);
  const valueType =
    mediaAcceptForClass(classType)
      ? "file"
      : classType === "ComfyUIDeployExternalBoolean"
      ? "boolean"
      : classType === "ComfyUIDeployExternalEnum"
        ? "enum"
        : classType.includes("Int") || classType.includes("Seed")
          ? "integer"
          : classType.includes("Number")
            ? "number"
            : "string";
  return {
    input_id: inputId,
    default_value: inputs.default_value,
    display_name: inputs.display_name,
    value_type: valueType,
    accept: mediaAcceptForClass(classType),
    options: valueType === "enum" ? parseEnumOptions(inputs.options, inputs.default_value) : undefined,
  };
}

function mediaAcceptForClass(classType: string) {
  if (classType === "ComfyUIDeployExternalImage") return "image/*";
  if (classType === "ComfyUIDeployExternalVideo") return "video/*";
  if (classType === "ComfyUIDeployExternalAudio") return "audio/*";
  if (classType === "ComfyUIDeployExternalEXR") return ".exr,image/*";
  if (classType === "ComfyUIDeployExternalFaceModel") return ".safetensors,.pt,.pth,.bin";
  if (classType === "ComfyUIDeployExternalFile") return "*/*";
  return undefined;
}

function parseEnumOptions(rawOptions: any, fallbackValue: any) {
  if (!rawOptions || !String(rawOptions).trim()) return fallbackValue ? [String(fallbackValue)] : [];
  const raw = String(rawOptions).trim();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  const separator = raw.includes("\n") ? /\r?\n/ : ",";
  return raw.split(separator).map((option) => option.trim()).filter(Boolean);
}

export function getDefaultInputValues(inputs: ExternalInputDefinition[]) {
  return Object.fromEntries(inputs.map((item) => [item.input_id, item.default_value ?? defaultValueForType(item.value_type)]));
}

function defaultValueForType(type: ExternalInputDefinition["value_type"]) {
  if (type === "boolean") return false;
  if (type === "number" || type === "integer") return 0;
  return "";
}

export function fileToRunInput(file: File): Promise<{ filename: string; mime_type: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve({
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        base64: result.includes(",") ? result.split(",", 2)[1] : result,
      });
    };
    reader.readAsDataURL(file);
  });
}
