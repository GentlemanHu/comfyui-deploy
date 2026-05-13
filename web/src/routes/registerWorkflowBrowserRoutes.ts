import { db } from "@/db/db";
import { workflowTable, workflowVersionTable } from "@/db/schema";
import type { App } from "@/routes/app";
import { authError } from "@/routes/authError";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
import { z, createRoute } from "@hono/zod-openapi";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const workflowListRoute = createRoute({
  method: "get",
  path: "/workflows",
  tags: ["comfyui"],
  summary: "List workflows for the ComfyUI plugin",
  request: {
    query: z.object({
      search: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(z.any()),
        },
      },
      description: "Workflow list",
    },
    ...authError,
  },
});

const workflowDetailRoute = createRoute({
  method: "get",
  path: "/workflow/:workflow_id",
  tags: ["comfyui"],
  summary: "Get workflow details for the ComfyUI plugin",
  request: {
    params: z.object({
      workflow_id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
      description: "Workflow detail",
    },
    ...authError,
  },
});

const workflowVersionsRoute = createRoute({
  method: "get",
  path: "/workflow/:workflow_id/versions",
  tags: ["comfyui"],
  summary: "List workflow versions for the ComfyUI plugin",
  request: {
    params: z.object({
      workflow_id: z.string(),
    }),
    query: z.object({
      limit: z.string().optional(),
      offset: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(z.any()),
        },
      },
      description: "Workflow versions",
    },
    ...authError,
  },
});

const workflowVersionRoute = createRoute({
  method: "get",
  path: "/workflow/:workflow_id/version/:version",
  tags: ["comfyui"],
  summary: "Get workflow version for the ComfyUI plugin",
  request: {
    params: z.object({
      workflow_id: z.string(),
      version: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
      description: "Workflow version",
    },
    ...authError,
  },
});

function getWorkflowOwnerWhere(
  userId: string,
  orgId: string | undefined | null,
  workflowId?: string,
) {
  const ownerFilter = orgId
    ? eq(workflowTable.org_id, orgId)
    : and(eq(workflowTable.user_id, userId), isNull(workflowTable.org_id));

  return workflowId
    ? and(ownerFilter, eq(workflowTable.id, workflowId))
    : ownerFilter;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const registerWorkflowBrowserRoutes = (app: App) => {
  app.openapi(workflowListRoute, async (c) => {
    const apiUser = c.get("apiKeyTokenData")!;
    if (!apiUser.user_id) {
      return c.json({ error: "Invalid user_id" }, { status: 500, headers: corsHeaders });
    }

    const { search, limit, offset } = c.req.valid("query");
    const safeLimit = Math.min(parsePositiveInteger(limit, 20), 100);
    const safeOffset = Math.max(parsePositiveInteger(offset, 0), 0);
    const ownerWhere = getWorkflowOwnerWhere(apiUser.user_id, apiUser.org_id);
    const where = search
      ? and(ownerWhere, ilike(workflowTable.name, `%${search}%`))
      : ownerWhere;

    const workflows = await db
      .select()
      .from(workflowTable)
      .where(where)
      .orderBy(desc(workflowTable.updated_at))
      .limit(safeLimit)
      .offset(safeOffset);

    return c.json(
      workflows.map((workflow) => ({
        ...workflow,
        user_icon: "",
        user_name: "Local",
        description: "",
        cover_image: "",
        pinned: false,
      })),
      { status: 200, headers: corsHeaders },
    );
  });

  app.openapi(workflowDetailRoute, async (c) => {
    const apiUser = c.get("apiKeyTokenData")!;
    if (!apiUser.user_id) {
      return c.json({ error: "Invalid user_id" }, { status: 500, headers: corsHeaders });
    }

    const { workflow_id } = c.req.valid("param");
    const workflow = await db.query.workflowTable.findFirst({
      where: getWorkflowOwnerWhere(apiUser.user_id, apiUser.org_id, workflow_id),
      with: {
        versions: {
          orderBy: desc(workflowVersionTable.version),
          limit: 1,
        },
      },
    });

    if (!workflow) {
      return c.json({ error: "No workflow found" }, { status: 404, headers: corsHeaders });
    }

    return c.json(workflow, { status: 200, headers: corsHeaders });
  });

  app.openapi(workflowVersionsRoute, async (c) => {
    const apiUser = c.get("apiKeyTokenData")!;
    if (!apiUser.user_id) {
      return c.json({ error: "Invalid user_id" }, { status: 500, headers: corsHeaders });
    }

    const { workflow_id } = c.req.valid("param");
    const { limit, offset } = c.req.valid("query");
    const safeLimit = Math.min(parsePositiveInteger(limit, 20), 100);
    const safeOffset = Math.max(parsePositiveInteger(offset, 0), 0);

    const workflow = await db.query.workflowTable.findFirst({
      where: getWorkflowOwnerWhere(apiUser.user_id, apiUser.org_id, workflow_id),
    });

    if (!workflow) {
      return c.json({ error: "No workflow found" }, { status: 404, headers: corsHeaders });
    }

    const versions = await db
      .select()
      .from(workflowVersionTable)
      .where(eq(workflowVersionTable.workflow_id, workflow_id))
      .orderBy(desc(workflowVersionTable.version))
      .limit(safeLimit)
      .offset(safeOffset);

    return c.json(versions, { status: 200, headers: corsHeaders });
  });

  app.openapi(workflowVersionRoute, async (c) => {
    const apiUser = c.get("apiKeyTokenData")!;
    if (!apiUser.user_id) {
      return c.json({ error: "Invalid user_id" }, { status: 500, headers: corsHeaders });
    }

    const { workflow_id, version } = c.req.valid("param");
    const workflow = await db.query.workflowTable.findFirst({
      where: getWorkflowOwnerWhere(apiUser.user_id, apiUser.org_id, workflow_id),
    });

    if (!workflow) {
      return c.json({ error: "No workflow found" }, { status: 404, headers: corsHeaders });
    }

    const workflowVersion = await db.query.workflowVersionTable.findFirst({
      where: and(
        eq(workflowVersionTable.workflow_id, workflow_id),
        eq(workflowVersionTable.version, Number.parseInt(version, 10)),
      ),
    });

    if (!workflowVersion) {
      return c.json({ error: "No version found" }, { status: 404, headers: corsHeaders });
    }

    return c.json(workflowVersion, { status: 200, headers: corsHeaders });
  });
};
