import type React from "react";

type ExampleWorkflow = {
  title: string;
  description: string;
  previewURL: string;
  image: { src: string; alt: string };
};

type EndpointDoc = {
  method: string;
  path: string;
  auth: string;
  purpose: string;
  request?: string;
  response: string;
};

const exampleWorkflows: ExampleWorkflow[] = [
  { title: "Txt2Img SDXL", description: "The basic workflow, type a prompt and generate images based on that.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl", image: { src: "/example-workflows/txt2img.webp", alt: "Txt2Img SDXL" } },
  { title: "Txt2Img LCM SDXL", description: "Images in a couple of seconds, increase the speed of each generation using LCM Lora.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-lcm-sdxl", image: { src: "/example-workflows/txt2img-lcm.webp", alt: "Txt2Img LCM SDXL" } },
  { title: "IPAdapter SDXL", description: "Load images and use them as reference for new generations.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-ip-adapter-sdxl", image: { src: "/example-workflows/ipadapter.webp", alt: "IPAdapter SDXL" } },
  { title: "Upscale and Add Detail SDXL", description: "Upscale and Add Details to your creations.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-upscale-and-add-detail-sdxl", image: { src: "/example-workflows/upscale.webp", alt: "Upscale and Add Detail SDXL" } },
  { title: "Txt2Img SDXL Turbo", description: "Try SDXL turbo and generate images since 1 step in seconds.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl-turbo", image: { src: "/example-workflows/txt2img-sdxl-turbo.webp", alt: "Txt2Img SDXL Turbo" } },
  { title: "Img2Img SDXL Controlnet", description: "This workflow uses canny. Generate lines of your original image and create variations.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-img2-img-sdxl-controlnet", image: { src: "/example-workflows/txt2img-controlnet.webp", alt: "Img2Img SDXL Controlnet" } },
  { title: "Automatic Inpainting (SEG)", description: "Type what you want to select and change that area with your prompt.", previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-automatic-inpainting-clip-seg", image: { src: "/example-workflows/automatic-inpainting-seg.webp", alt: "Automatic Inpainting (SEG)" } },
];

const endpoints: EndpointDoc[] = [
  { method: "POST", path: "/api/run", auth: "Bearer API Key", purpose: "Create a workflow run from deployment_id, or manually from workflow_version_id + machine_id. Asset inputs accept URL, data URL, base64, or {base64,mime_type,filename}; inline assets are uploaded to S3/MinIO automatically.", request: `{"deployment_id":"uuid","inputs":{"input_image":{"base64":"...","mime_type":"image/png","filename":"input.png"}}} or {"workflow_version_id":"uuid","machine_id":"uuid","inputs":{},"run_origin":"manual"}`, response: `{"run_id":"uuid"}` },
  { method: "GET", path: "/api/run?run_id=<id>", auth: "Bearer API Key", purpose: "Original polling API. Returns run status and outputs with public file URLs when available.", response: `{"id":"uuid","status":"success","outputs":[{"data":{"images":[{"filename":"out.webp","url":"https://..." }]}}]}` },
  { method: "GET", path: "/api/run/<id>", auth: "Bearer API Key", purpose: "Get one run record without embedding outputs.", response: `{"id":"uuid","status":"running","origin":"manual"}` },
  { method: "GET", path: "/api/run/<id>/outputs", auth: "Bearer API Key", purpose: "List every staged output row for the run.", response: `[{"id":"uuid","run_id":"uuid","data":{"images":[]}}]` },
  { method: "GET", path: "/api/upload-url", auth: "Bearer API Key", purpose: "Create signed PUT URL for workflow input files.", request: `?type=image/png&file_size=12345`, response: `{"upload_url":"https://...","download_url":"https://...","file_id":"img-...","include_acl":true}` },
  { method: "POST", path: "/api/workflow", auth: "Bearer API Key", purpose: "Upload a workflow from the ComfyUI plugin or create a new version.", request: `{"workflow_name":"Name","workflow":{},"workflow_api":{},"snapshot":{},"comment":"optional"}`, response: `{"workflow_id":"uuid","version":1}` },
  { method: "GET", path: "/api/workflows", auth: "Bearer API Key", purpose: "List workflows for the user/org.", request: `?limit=20&offset=0&search=optional`, response: `[{"id":"uuid","name":"Workflow","versions":[],"deployments":[]}]` },
  { method: "GET", path: "/api/workflow/<id>", auth: "Bearer API Key", purpose: "Get workflow details and latest versions.", response: `{"id":"uuid","name":"Workflow","versions":[]}` },
  { method: "GET", path: "/api/workflow/<id>/versions", auth: "Bearer API Key", purpose: "List workflow versions.", response: `[{"id":"uuid","version":1,"workflow_api":{}}]` },
  { method: "GET", path: "/api/workflow/<id>/version/<number>", auth: "Bearer API Key", purpose: "Get a workflow version by version number.", response: `{"id":"uuid","version":1,"workflow_api":{}}` },
  { method: "GET", path: "/api/workflow-version/<id>", auth: "Bearer API Key", purpose: "Get a workflow version by id.", response: `{"id":"uuid","workflow":{},"workflow_api":{},"snapshot":{}}` },
  { method: "POST", path: "/api/workflow/<id>/deployments", auth: "Bearer API Key", purpose: "Create or update production/staging/public-share deployment.", request: `{"version_id":"uuid","machine_id":"uuid","environment":"production"}`, response: `{"id":"uuid","environment":"production"}` },
  { method: "GET", path: "/api/workflow/<id>/deployments", auth: "Bearer API Key", purpose: "List deployments for a workflow.", response: `[{"id":"uuid","environment":"production"}]` },
  { method: "GET", path: "/api/stats", auth: "Bearer API Key or Basic Auth", purpose: "Global request statistics grouped by workflow, machine, origin, version, status, deployment, and date.", response: `{"overview":{"total_runs":42},"workflows":[],"machines":[],"daily":[]}` },
  { method: "GET", path: "/api/workflow/<id>/stats", auth: "Bearer API Key or Basic Auth", purpose: "Workflow statistics grouped by machine, origin, version, status, deployment, and date.", response: `{"overview":{"total_runs":12},"machines":[],"versions":[],"daily":[]}` },
  { method: "GET", path: "/api/machines", auth: "Bearer API Key", purpose: "List machines.", response: `[{"id":"uuid","name":"Machine","endpoint":"https://...","type":"classic","status":"ready"}]` },
  { method: "POST", path: "/api/machines", auth: "Bearer API Key", purpose: "Create a machine.", request: `{"name":"Machine","endpoint":"https://comfy.example.com","auth_token":"optional","type":"classic","gpu":"T4"}`, response: `{"id":"uuid","status":"ready"}` },
  { method: "GET", path: "/api/api-keys", auth: "Bearer API Key or Basic Auth", purpose: "List API keys.", response: `[{"id":"uuid","name":"Key","masked_key":"****abcd"}]` },
  { method: "POST", path: "/api/api-keys", auth: "Bearer API Key or Basic Auth", purpose: "Create an API key.", request: `{"name":"My API Key"}`, response: `{"id":"uuid","key":"jwt"}` },
  { method: "GET", path: "/api/doc", auth: "No Bearer required", purpose: "OpenAPI-style JSON for tooling and AI agents.", response: `{"openapi":"3.0.0","paths":{...}}` },
  { method: "GET", path: "/api/share/<share_id>", auth: "Public / X-Share-Key", purpose: "Get public share page data.", response: `{"workflow_name":"Workflow","deployment":{"access_key_enabled":true}}` },
  { method: "POST", path: "/api/share/<share_id>/run", auth: "Public / X-Share-Key", purpose: "Run a public share without a Bearer API key. Asset inputs support URL/data URL/base64 and are uploaded to S3/MinIO automatically.", request: `{"inputs":{"input_image":{"base64":"...","mime_type":"image/png","filename":"input.png"}}}`, response: `{"run_id":"uuid"}` },
  { method: "GET", path: "/api/share/<share_id>/run/<run_id>", auth: "Public / X-Share-Key", purpose: "Poll public-share run status, progress, current node, and live status.", response: `{"id":"uuid","status":"running","progress":80,"current_node":"VAEDecode"}` },
  { method: "GET", path: "/api/share/<share_id>/run/<run_id>/outputs", auth: "Public / X-Share-Key", purpose: "List public-share staged outputs.", response: `[{"id":"uuid","data":{"images":[]}}]` },
  { method: "POST", path: "/api/update-run", auth: "Internal callback", purpose: "ComfyUI/plugin callback for status, logs, live status, and staged output rows.", request: `{"run_id":"uuid","status":"running","output_data":{},"node_meta":{}}`, response: `{"message":"success"}` },
  { method: "GET", path: "/api/file-upload", auth: "Internal callback", purpose: "ComfyUI/plugin callback helper for output file signed PUT URLs.", request: `?file_name=out.webp&run_id=uuid&type=image/webp`, response: `{"url":"https://...","include_acl":true}` },
];

export function DocsPage({ path }: { path: string }) {
  if (path === "/examples") return <ExamplesPage />;
  if (path === "/docs/endpoints") return <EndpointsPage />;
  return <InstallPage />;
}

function ExamplesPage() {
  return (
    <div className="w-full py-4">
      <section className="mx-auto flex max-w-[980px] flex-col items-center gap-2 py-8 md:py-12 md:pb-8 lg:py-24 lg:pb-20">
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl">Check out some examples</h1>
        <p className="max-w-[560px] text-center text-lg text-muted-foreground">Text to Image, Image to Image, IPAdapter, and more. Here are some examples that you can use to deploy your workflow.</p>
      </section>
      <section className="flex flex-wrap justify-center gap-5">
        {exampleWorkflows.map((workflow) => (
          <div key={workflow.title} className="w-[350px] rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <div className="text-xl font-semibold">{workflow.title}</div>
              <div className="text-sm text-muted-foreground">{workflow.description}</div>
            </div>
            <div className="px-6">
              <img className="h-[230px] w-full rounded-md object-cover" src={workflow.image.src} alt={workflow.image.alt} />
            </div>
            <div className="flex justify-end p-6 pt-4">
              <a className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground" href={workflow.previewURL} target="_blank" rel="noreferrer">View Workflow</a>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function InstallPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">Getting started</h1>
      <p className="text-lg text-muted-foreground">Install the Comfy Deploy plugin, configure your API endpoint, create an API key, then deploy a workflow from ComfyUI.</p>
      <DocCard title="Install plugin">
        <CodeBlock value={`cd ComfyUI/custom_nodes\ngit clone https://github.com/BennyKok/comfyui-deploy.git\n# restart ComfyUI`} />
      </DocCard>
      <DocCard title="Configure auth">
        <p>Open the Comfy Deploy panel in ComfyUI, set the endpoint to this Go console domain, then create or paste an API key from the API Keys page.</p>
      </DocCard>
      <DocCard title="OpenAPI JSON">
        <p>Machine-readable API documentation is available at <a className="underline" href="/api/doc" target="_blank" rel="noreferrer">/api/doc</a>.</p>
      </DocCard>
    </div>
  );
}

function EndpointsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-10">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">Workflow API</h1>
        <p className="text-lg text-muted-foreground">Use <code>Authorization: Bearer &lt;API_KEY&gt;</code> for protected endpoints. The full OpenAPI-style JSON is available at <a className="underline" href="/api/doc" target="_blank" rel="noreferrer">/api/doc</a>.</p>
      </div>
      <DocCard title="Typical run flow">
        <CodeBlock value={`POST /api/run -> { "run_id": "..." }\nGET /api/run?run_id=<run_id> until status is success or failed\nRead outputs[].data.images/files/gifs[].url or use /api/run/<run_id>/outputs for staged rows`} />
      </DocCard>
      <div className="grid gap-3">
        {endpoints.map((item) => <EndpointItem key={`${item.method}-${item.path}`} item={item} />)}
      </div>
    </div>
  );
}

function EndpointItem({ item }: { item: EndpointDoc }) {
  return (
    <details className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-w-[64px] justify-center rounded-md border px-2 py-1 text-xs font-semibold">{item.method}</span>
          <code className="text-sm font-semibold">{item.path}</code>
          <span className="text-xs text-muted-foreground">{item.auth}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{item.purpose}</p>
      </summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {item.request ? <CodeBlock title="Request" value={item.request} /> : <div className="text-sm text-muted-foreground">No request body.</div>}
        <CodeBlock title="Response" value={item.response} />
      </div>
    </details>
  );
}

function DocCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ value, title }: { value: string; title?: string }) {
  return (
    <div className="grid gap-2">
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}
