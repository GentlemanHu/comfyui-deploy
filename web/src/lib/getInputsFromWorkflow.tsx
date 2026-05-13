import type { getWorkflowVersionFromVersionIndex } from "../components/VersionSelect";
import { getExternalInputDefinition } from "@/lib/externalInputs";

export function getInputsFromWorkflow(
  workflow_version: ReturnType<typeof getWorkflowVersionFromVersionIndex>
) {
  if (!workflow_version || !workflow_version.workflow_api) return null;
  return Object.entries(workflow_version.workflow_api)
    .map(([_, value]) => {
      return getExternalInputDefinition(value);
    })
    .filter((item) => item !== undefined);
}
