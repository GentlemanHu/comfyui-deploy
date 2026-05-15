import { type ReactNode, useEffect } from "react";
import { Navbar } from "./Navbar";
import { TooltipProvider } from "./ui/tooltip";

export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;
    fetch("/api/session", { credentials: "include" }).then((response) => {
      if (active && response.status === 401) {
        window.location.assign(window.location.pathname + window.location.search);
      }
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <TooltipProvider>
      <main className="w-full flex min-h-[100dvh] flex-col items-center justify-start">
        <div className="z-[-1] fixed h-full w-full bg-white">
          <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        </div>
        <div className="sticky w-full h-18 flex items-center justify-between gap-4 p-4 border-b border-gray-200">
          <Navbar />
        </div>
        <div className="md:px-10 px-6 w-full h-[calc(100dvh-73px)]">{children}</div>
      </main>
    </TooltipProvider>
  );
}
