import { BookOpen } from "lucide-react";

const docs: Record<string, { title: string; body: string[] }> = {
  "/examples": {
    title: "Examples",
    body: [
      "Deploy workflows from the ComfyUI plugin, then run them from API keys or the local console.",
      "Use External Text, Number, Boolean, Seed, Enum, File, Image, Video and Audio nodes to expose inputs."
    ]
  },
  "/docs/install": {
    title: "Install",
    body: [
      "Place this repository under ComfyUI/custom_nodes/comfyui-deploy and restart ComfyUI.",
      "Set the plugin endpoint to your ComfyDeploy domain, then grant access through the auth page."
    ]
  },
  "/docs/endpoints": {
    title: "Endpoints",
    body: [
      "Use Bearer API keys for /api/run, /api/upload-url, /api/workflow and workflow version endpoints.",
      "The local console uses same-origin Basic Auth and does not expose API keys in browser storage."
    ]
  }
};

export function DocsPage({ path }: { path: string }) {
  const doc = docs[path] ?? docs["/examples"];
  return (
    <div className="detailApp">
      <header className="shareHero">
        <div className="brandMark"><BookOpen size={22} /></div>
        <h1>{doc.title}</h1>
      </header>
      <section className="panel sharePanel">
        <div className="panelTitle"><h2><BookOpen size={18} />ComfyDeploy</h2></div>
        <div className="docBody">
          {doc.body.map((item) => <p key={item}>{item}</p>)}
        </div>
      </section>
    </div>
  );
}
