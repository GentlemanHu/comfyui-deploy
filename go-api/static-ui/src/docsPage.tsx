type ExampleWorkflow = {
  title: string;
  description: string;
  previewURL: string;
  image: {
    src: string;
    alt: string;
  };
};

const exampleWorkflows: ExampleWorkflow[] = [
  {
    title: "Txt2Img SDXL",
    description: "The basic workflow, type a prompt and generate images based on that.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl",
    image: {
      src: "/example-workflows/txt2img.webp",
      alt: "Txt2Img SDXL",
    },
  },
  {
    title: "Txt2Img LCM SDXL",
    description: "Images in a couple of seconds, increase the speed of each generation using LCM Lora.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-lcm-sdxl",
    image: {
      src: "/example-workflows/txt2img-lcm.webp",
      alt: "Txt2Img LCM SDXL",
    },
  },
  {
    title: "IPAdapter SDXL",
    description: "Load images and use them as reference for new generations.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-ip-adapter-sdxl",
    image: {
      src: "/example-workflows/ipadapter.webp",
      alt: "IPAdapter SDXL",
    },
  },
  {
    title: "Upscale and Add Detail SDXL",
    description: "Upscale and Add Details to your creations.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-upscale-and-add-detail-sdxl",
    image: {
      src: "/example-workflows/upscale.webp",
      alt: "Upscale and Add Detail SDXL",
    },
  },
  {
    title: "Txt2Img SDXL Turbo",
    description: "Try SDXL turbo and generate images since 1 step in seconds.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-txt2img-sdxl-turbo",
    image: {
      src: "/example-workflows/txt2img-sdxl-turbo.webp",
      alt: "Txt2Img SDXL Turbo",
    },
  },
  {
    title: "Img2Img SDXL Controlnet",
    description: "This workflow uses canny. Generate lines of your original image and create variations.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-img2-img-sdxl-controlnet",
    image: {
      src: "/example-workflows/txt2img-controlnet.webp",
      alt: "Img2Img SDXL Controlnet",
    },
  },
  {
    title: "Automatic Inpainting (SEG)",
    description: "Type what you want to select and change that area with your prompt.",
    previewURL: "https://www.comfydeploy.com/share/comfy-deploy-example-automatic-inpainting-clip-seg",
    image: {
      src: "/example-workflows/automatic-inpainting-seg.webp",
      alt: "Automatic Inpainting (SEG)",
    },
  },
];

const docs: Record<string, { title: string; body: string[] }> = {
  "/docs/install": {
    title: "Install",
    body: [
      "Place this repository under ComfyUI/custom_nodes/comfyui-deploy and restart ComfyUI.",
      "Set the plugin endpoint to your ComfyDeploy domain, then grant access through the auth page.",
    ],
  },
  "/docs/endpoints": {
    title: "Endpoints",
    body: [
      "Use Bearer API keys for /api/run, /api/upload-url, /api/workflow and workflow version endpoints.",
      "The local console uses same-origin Basic Auth and does not expose API keys in browser storage.",
    ],
  },
};

export function DocsPage({ path }: { path: string }) {
  if (path === "/examples") {
    return (
      <div className="w-full py-4">
        <section className="mx-auto flex max-w-[980px] flex-col items-center gap-2 py-8 md:py-12 md:pb-8 lg:py-24 lg:pb-20">
          <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight lg:text-5xl">
            Check out some examples
          </h1>
          <p className="max-w-[560px] text-center text-lg text-muted-foreground">
            Text to Image, Image to Image, IPAdapter, and more. Here are some examples that you can use to deploy your workflow.
          </p>
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
                <a className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground" href={workflow.previewURL} target="_blank" rel="noreferrer">
                  View Workflow
                </a>
              </div>
            </div>
          ))}
        </section>
      </div>
    );
  }

  const doc = docs[path] ?? docs["/docs/install"];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{doc.title}</h1>
        <p className="text-lg text-muted-foreground">ComfyDeploy documentation</p>
      </div>
      <div className="rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <div className="prose prose-neutral max-w-none dark:prose-invert">
          {doc.body.map((item) => <p key={item}>{item}</p>)}
        </div>
      </div>
    </div>
  );
}
