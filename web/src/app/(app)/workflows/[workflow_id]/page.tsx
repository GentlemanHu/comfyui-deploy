import { findWorkflowById } from "@/server/findFirstTableWithVersion";
import { redirect } from "next/navigation";

export const maxDuration:Number = parseInt(process.env.MAX_DURATION, 10) || 600 ; // 5 minutes

export default async function Page({
  params,
}: {
  params: { workflow_id: string };
}) {
  const workflow = await findWorkflowById(params.workflow_id);
  if (!workflow) redirect("/workflows");

  return <></>;
}
