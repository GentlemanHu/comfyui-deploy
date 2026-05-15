import { Loader2, Upload } from "lucide-react";
import { type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { fileToRunInput, type ExternalInputDefinition } from "../lib/externalInputs";

export function RunInputField({ item, values, setValues }: { item: ExternalInputDefinition; values: Record<string, any>; setValues: Dispatch<SetStateAction<Record<string, any>>> }) {
  const value = values[item.input_id];
  const label = item.display_name || item.input_id;
  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{label}</div>
      {item.value_type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(value ?? item.default_value ?? false)} onChange={(event) => setValues((prev) => ({ ...prev, [item.input_id]: event.target.checked }))} />
          <span>Enabled</span>
        </label>
      ) : item.value_type === "file" ? (
        <AssetInput item={item} value={value} setValues={setValues} />
      ) : item.value_type === "enum" && item.options?.length ? (
        <select className="h-10 rounded-md border bg-background px-3" value={String(value ?? item.default_value ?? item.options[0] ?? "")} onChange={(event) => setValues((prev) => ({ ...prev, [item.input_id]: event.target.value }))}>
          {item.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <Input
          type={item.value_type === "number" || item.value_type === "integer" ? "number" : "text"}
          value={String(value ?? item.default_value ?? "")}
          onChange={(event) => setValues((prev) => ({
            ...prev,
            [item.input_id]: item.value_type === "number" || item.value_type === "integer" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value,
          }))}
        />
      )}
    </div>
  );
}

function AssetInput({ item, value, setValues }: { item: ExternalInputDefinition; value: any; setValues: Dispatch<SetStateAction<Record<string, any>>> }) {
  const inputID = `asset-input-${item.input_id}`;
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          id={inputID}
          className="sr-only"
          type="file"
          accept={item.accept}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setValues((prev) => ({ ...prev, [item.input_id]: { filename: file.name, mime_type: file.type, uploading: true } }));
            try {
              const uploaded = await fileToRunInput(file);
              setValues((prev) => ({ ...prev, [item.input_id]: uploaded }));
            } catch (error) {
              setValues((prev) => {
                const next = { ...prev };
                delete next[item.input_id];
                return next;
              });
              toast.error(String(error));
            } finally {
              event.target.value = "";
            }
          }}
        />
        <Button asChild variant="outline">
          <label htmlFor={inputID} className="cursor-pointer">
            {value?.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </label>
        </Button>
        {value?.filename ? <div className="min-w-0 truncate text-sm text-muted-foreground">{value.filename}</div> : <div className="text-sm text-muted-foreground">URL, data URL, or local file</div>}
      </div>
      <Input
        placeholder="https://... or data URL"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => setValues((prev) => ({ ...prev, [item.input_id]: event.target.value }))}
      />
    </div>
  );
}

export function hasUploadingRunInputs(values: Record<string, any>) {
  return Object.values(values).some((value) => value && typeof value === "object" && value.uploading === true);
}
