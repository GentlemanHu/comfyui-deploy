import { Github, Menu, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { navigate } from "@/api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const pages = [
  { name: "Workflows", path: "/workflows" },
  { name: "Machines", path: "/machines" },
  { name: "API Keys", path: "/api-keys" },
  { name: "Examples", path: "/examples" },
];

export function Navbar() {
  const _isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDesktop, setIsDesktop] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  useEffect(() => setIsDesktop(_isDesktop), [_isDesktop]);

  return (
    <>
      <div className="flex flex-row items-center gap-4">
        {!isDesktop && (
          <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center justify-center w-8 h-8 p-2">
                <Menu />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col gap-4">
              <SheetHeader>
                <SheetTitle className="text-start">Comfy Deploy</SheetTitle>
              </SheetHeader>
              <div className="grid h-full grid-rows-[1fr_auto]">
                <NavbarMenu className="h-full" closeSheet={() => setSheetOpen(false)} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Local Admin</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="text-sm text-muted-foreground">Local authentication is enabled.</div>
                  </PopoverContent>
                </Popover>
              </div>
            </SheetContent>
          </Sheet>
        )}
        <a className="font-bold text-md md:text-lg hover:underline" href="/" onClick={(event) => route(event, "/")}>
          Comfy Deploy
        </a>
        {isDesktop && <span className="text-sm text-muted-foreground">Local</span>}
      </div>
      <div className="flex flex-row items-center gap-2">
        {isDesktop && <NavbarMenu />}
        <Button asChild variant="link" className="rounded-full aspect-square p-2 mr-4">
          <a href="/docs/install" onClick={(event) => route(event, "/docs/install")}>Docs</a>
        </Button>
        <Button variant="ghost" className="gap-2">
          <UserCircle size={18} />
          <span className="hidden md:inline">Local Admin</span>
        </Button>
        <Button asChild variant="outline" className="rounded-full aspect-square p-2">
          <a target="_blank" href="https://github.com/BennyKok/comfyui-deploy" rel="noreferrer">
            <Github />
          </a>
        </Button>
      </div>
    </>
  );
}

export function NavbarMenu({ className, closeSheet }: { className?: string; closeSheet?: () => void }) {
  const _isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => setIsDesktop(_isDesktop), [_isDesktop]);
  const pathname = `/${window.location.pathname.split("/")[1] || "workflows"}`;

  return (
    <div className={cn("mr-2", className)}>
      {isDesktop && (
        <Tabs defaultValue={pathname === "/" ? "/workflows" : pathname} className="w-fit flex pointer-events-auto">
          <TabsList className="w-full">
            {pages.map((page) => (
              <TabsTrigger key={page.name} value={page.path}>
                <a href={page.path} onClick={(event) => route(event, page.path)}>{page.name}</a>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {!isDesktop && (
        <ScrollArea>
          <div className="w-full flex flex-col h-full">
            {pages.map((page) => (
              <a
                key={page.name}
                href={page.path}
                onClick={(event) => {
                  route(event, page.path);
                  closeSheet?.();
                }}
                className="p-2 hover:bg-gray-100/20 hover:underline"
              >
                {page.name}
              </a>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function route(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  navigate(path);
}
