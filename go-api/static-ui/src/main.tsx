import React, { type MouseEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { ArrowUpDown, Copy, Loader2, MoreHorizontal, Pencil, Plus, RefreshCcw } from "lucide-react";
import { ColumnDef, ColumnFiltersState, SortingState, VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { api, APIKey, Deployment, Machine, navigate, Run, WorkflowItem, WorkflowVersion } from "./api";
import { useResource } from "./hooks";
import { AuthRequest } from "./authRequest";
import { DocsPage } from "./docsPage";
import { MachineDetail } from "./machineDetail";
import { Shell } from "./components/Shell";
import { SharePage } from "./sharePage";
import { ShareSettings } from "./shareSettings";
import { StatsPage } from "./statsPage";
import { WorkflowDetail } from "./workflowDetail";
import { getRelativeTime } from "./lib/getRelativeTime";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./components/ui/dropdown-menu";
import { Input } from "./components/ui/input";
import { ScrollArea } from "./components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import "./globals.css";

const META = {
  name: "Comfy Deploy",
  author: "BennyKok",
  tagline: "Stable Diffusion from your terminal to the world",
  description: "From your comfyui workflow to production ready API, flexibility at the speed of thought",
};

function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const grantMatch = path.match(/^\/auth(?:-request|\/request)\/([^/]+)$/);
  const shareSettingsMatch = path.match(/^\/share\/([^/]+)\/settings$/);
  const shareMatch = path.match(/^\/share\/([^/]+)$/);
  const workflowMatch = path.match(/^\/workflows\/([^/]+)$/);
  const machineMatch = path.match(/^\/machines\/([^/]+)$/);

  let page: React.ReactNode;
  if (grantMatch) page = <AuthRequest requestID={decodeURIComponent(grantMatch[1])} />;
  else if (shareSettingsMatch) page = <Shell><ShareSettings shareID={decodeURIComponent(shareSettingsMatch[1])} /></Shell>;
  else if (shareMatch) page = <SharePage shareID={decodeURIComponent(shareMatch[1])} />;
  else if (workflowMatch) page = <Shell><WorkflowDetail workflowID={decodeURIComponent(workflowMatch[1])} /></Shell>;
  else if (machineMatch) page = <Shell><MachineDetail machineID={decodeURIComponent(machineMatch[1])} /></Shell>;
  else if (["/examples", "/docs", "/docs/install", "/docs/endpoints"].includes(path)) page = <Shell><DocsPage path={path === "/docs" ? "/docs/install" : path} /></Shell>;
  else if (path === "/stats") page = <Shell><StatsPage /></Shell>;
  else if (path === "/machines") page = <Shell><MachinesPage /></Shell>;
  else if (path === "/api-keys") page = <Shell><APIKeysPage /></Shell>;
  else if (path === "/") page = <Shell><HomePage /></Shell>;
  else page = <Shell><WorkflowsPage /></Shell>;
  return (
    <>
      {page}
      <Toaster richColors />
    </>
  );
}

function WorkflowsPage() {
  const workflows = useResource<WorkflowItem[]>("/api/workflows?limit=200");
  const data = (workflows.data ?? []).map((item) => ({ ...item, user: item.user ?? { name: "Local Admin" } }));
  return (
    <div className="h-full">
      <AsyncState loading={workflows.loading} error={workflows.error} onRetry={workflows.reload} />
      {!workflows.loading && <WorkflowTable data={data} onDeleted={workflows.reload} />}
    </div>
  );
}

function WorkflowTable({ data, onDeleted }: { data: WorkflowItem[]; onDeleted: () => Promise<void> }) {
  const columns = useMemo<ColumnDef<WorkflowItem>[]>(() => [
    selectColumn<WorkflowItem>(),
    {
      accessorKey: "name",
      header: ({ column }) => <SortButton column={column} label="Name" />,
      cell: ({ row }) => (
        <a className="hover:underline flex gap-2" href={`/workflows/${row.original.id}`} onClick={(event) => route(event, `/workflows/${row.original.id}`)}>
          <span className="truncate max-w-[200px]">{row.original.name}</span>
          <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-zinc-600/10 text-zinc-700">v{row.original.versions?.[0]?.version ?? "-"}</span>
          {row.original.deployments?.[0] && <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-green-500/15 text-green-700">Public</span>}
        </a>
      ),
    },
    { accessorKey: "creator", header: ({ column }) => <SortButton column={column} label="Creator" />, cell: ({ row }) => <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-cyan-400/20 text-cyan-700">{row.original.user?.name ?? "Local Admin"}</span> },
    { accessorKey: "date", sortingFn: "datetime", header: ({ column }) => <SortButton column={column} label="Update Date" right />, cell: ({ row }) => <div className="w-full capitalize text-right truncate">{getRelativeTime(row.original.updated_at)}</div> },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowMenu items={[{ label: "Delete Workflow", destructive: true, action: async () => { await api(`/api/workflow/${row.original.id}`, { method: "DELETE" }); await onDeleted(); } }]} />
      ),
    },
  ], [onDeleted]);
  return <DataTable data={data} columns={columns} filterColumn="name" filterPlaceholder="Filter workflows..." fullHeight />;
}

function MachinesPage() {
  const machines = useResource<Machine[]>("/api/machines");
  return (
    <div className="w-full">
      <AsyncState loading={machines.loading} error={machines.error} onRetry={machines.reload} />
      {!machines.loading && <MachineTable data={machines.data ?? []} onChanged={machines.reload} />}
    </div>
  );
}

function MachineTable({ data, onChanged }: { data: Machine[]; onChanged: () => Promise<void> }) {
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const columns = useMemo<ColumnDef<Machine>[]>(() => [
    selectColumn<Machine>(),
    {
      accessorKey: "name",
      header: ({ column }) => <SortButton column={column} label="Name" />,
      cell: ({ row }) => (
        <div className="flex flex-row gap-2 items-center truncate">
          <a href={`/machines/${row.original.id}`} onClick={(event) => route(event, `/machines/${row.original.id}`)} className="hover:underline">{row.original.name}</a>
          {row.original.disabled && <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-red-500/15 text-red-700">Disabled</span>}
          {row.original.status === "building" && <span className="inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-amber-400/20 text-amber-700 capitalize">building <Loader2 className="ml-1 h-3 w-3 animate-spin" /></span>}
          {!row.original.disabled && row.original.status && <span className={row.original.status === "ready" ? "inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-green-500/15 text-green-700 capitalize" : "inline-flex items-center gap-x-1.5 rounded-md px-2 py-0.5 text-sm font-medium bg-red-500/15 text-red-700 capitalize"}>{row.original.status}</span>}
        </div>
      ),
    },
    { accessorKey: "endpoint", header: () => <div className="text-left">Endpoint</div>, cell: ({ row }) => <div className="text-left font-medium truncate max-w-[400px]">{row.original.endpoint}</div> },
    { accessorKey: "type", header: () => <div className="text-left">Type</div>, cell: ({ row }) => <div className="text-left font-medium truncate">{row.original.type}</div> },
    { accessorKey: "date", sortingFn: "datetime", header: ({ column }) => <SortButton column={column} label="Update Date" right />, cell: ({ row }) => <div className="capitalize text-right">{getRelativeTime(row.original.updated_at)}</div> },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowMenu
          items={[
            { label: "Open ComfyUI", action: async () => { window.open(row.original.endpoint, "_blank", "noopener,noreferrer"); }, silent: true },
            { label: "Edit", action: async () => { setEditingMachine(row.original); }, silent: true },
            { label: "Delete Machine", destructive: true, action: async () => { await api(`/api/machines/${row.original.id}`, { method: "DELETE" }); await onChanged(); } },
          ]}
        />
      ),
    },
  ], [onChanged]);
  return (
    <>
      <div className="flex items-center py-4">
        <div className="max-w-sm text-sm text-muted-foreground">
          Manage custom ComfyUI machines and local endpoints.
        </div>
        <div className="ml-auto flex gap-2">
          <MachineDialog onChanged={onChanged} />
        </div>
      </div>
      <DataTable data={data} columns={columns} filterColumn="name" filterPlaceholder="Filter machines..." />
      <MachineDialog machine={editingMachine} onChanged={async () => { setEditingMachine(null); await onChanged(); }} onOpenChange={(open) => { if (!open) setEditingMachine(null); }} />
    </>
  );
}

function APIKeysPage() {
  const keys = useResource<APIKey[]>("/api/api-keys");
  const data = (keys.data ?? []).map((item) => ({ ...item, endpoint: item.masked_key ?? "****", date: item.updated_at }));
  return (
    <div className="w-full">
      <AsyncState loading={keys.loading} error={keys.error} onRetry={keys.reload} />
      {!keys.loading && <APIKeyTable data={data} onChanged={keys.reload} />}
    </div>
  );
}

function APIKeyTable({ data, onChanged }: { data: APIKey[]; onChanged: () => Promise<void> }) {
  const columns = useMemo<ColumnDef<APIKey>[]>(() => [
    selectColumn<APIKey>(),
    { accessorKey: "name", header: ({ column }) => <SortButton column={column} label="Name" />, cell: ({ row }) => row.original.name },
    { accessorKey: "endpoint", header: () => <div className="text-left">Endpoint</div>, cell: ({ row }) => <div className="text-left font-medium">{row.original.endpoint}</div> },
    { accessorKey: "date", sortingFn: "datetime", header: ({ column }) => <SortButton column={column} label="Update Date" right />, cell: ({ row }) => <div className="capitalize text-right">{getRelativeTime(row.original.updated_at)}</div> },
    { id: "actions", cell: ({ row }) => <APIKeyActions item={row.original} onChanged={onChanged} /> },
  ], [onChanged]);
  return (
    <>
      <div className="flex items-center py-4">
        <div className="max-w-sm text-sm text-muted-foreground">
          Create API keys for programmatic workflow runs.
        </div>
        <div className="ml-auto flex gap-2">
          <APIKeyDialog onChanged={onChanged} />
        </div>
      </div>
      <DataTable data={data} columns={columns} filterColumn="name" filterPlaceholder="Filter keys..." />
    </>
  );
}

function APIKeyActions({ item, onChanged }: { item: APIKey; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [fullKey, setFullKey] = useState("");
  const [loading, setLoading] = useState(false);
  const loadKey = async () => {
    setLoading(true);
    try {
      const result = await api<APIKey>(`/api/api-keys/${item.id}`);
      setFullKey(result.key ?? "");
      setOpen(true);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <RowMenu
        items={[
          { label: "View API Key", action: loadKey, silent: true },
          { label: "Delete API Key", destructive: true, action: async () => { await api(`/api/api-keys/${item.id}`, { method: "DELETE" }); await onChanged(); } },
        ]}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>Copy this API key for workflow upload and API runs.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="text-sm font-medium">API Key</div>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <code className="truncate text-xs">{loading ? "Loading..." : fullKey}</code>
              <Button size="sm" variant="outline" disabled={!fullKey} onClick={() => navigator.clipboard.writeText(fullKey)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HomePage() {
  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col items-center gap-10">
        <section className="w-full min-h-[calc(100dvh-73px)] flex flex-col justify-center">
          <div className="flex flex-col justify-center gap-2 max-w-5xl mx-auto w-full">
            <a
              className="text-sm rounded-full border px-3 py-1 w-fit hover:underline"
              href="https://github.com/BennyKok/comfyui-deploy"
              target="_blank"
              rel="noreferrer"
            >
              ✨ Open Source on Github
            </a>

            <h1 className="text-left">
              <span className="text-5xl sm:text-6xl md:text-7xl pb-2 inline-flex animate-background-shine bg-[linear-gradient(110deg,#1e293b,45%,#939393,55%,#1e293b)] bg-[length:250%_100%] bg-clip-text text-transparent">
                {META.tagline}
              </span>
            </h1>

            <p className="text-left text-muted-foreground text-lg max-w-3xl">
              {META.description}
            </p>

            <div>
              <Button
                className="mt-10 px-8 py-8 rounded-2xl w-fit text-lg font-bold"
                onClick={() => navigate("/workflows")}
              >
                Get Started
              </Button>
            </div>
          </div>
        </section>
      </div>

      <footer className="text-base-content mx-auto flex flex-col md:flex-row items-center justify-center w-full max-w-5xl gap-4 p-10">
        <div className="font-bold">{META.name}</div>
        <div>© {META.author} 2023 . All rights reserved.</div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

function route(event: MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  navigate(path);
}

export { api, navigate };

function selectColumn<T>(): ColumnDef<T> {
  return {
    accessorKey: "id",
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

function SortButton({ column, label, right }: { column: any; label: string; right?: boolean }) {
  return (
    <button className={`${right ? "w-full justify-end" : ""} flex items-center hover:underline truncate`} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </button>
  );
}

function DataTable<T>({ data, columns, filterColumn, filterPlaceholder, fullHeight }: { data: T[]; columns: ColumnDef<T>[]; filterColumn: string; filterPlaceholder: string; fullHeight?: boolean }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });
  return (
    <div className={fullHeight ? "grid grid-rows-[auto,1fr,auto] h-full" : "w-full"}>
      <div className="flex flex-row w-full items-center py-4">
        <Input
          placeholder={filterPlaceholder}
          value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
          className="max-w-sm"
        />
      </div>
      <ScrollArea className={`${fullHeight ? "h-full" : ""} w-full rounded-md border`}>
        <Table>
          <TableHeader className="bg-background top-0 sticky">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No results.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="flex flex-row items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ items }: { items: { label: string; destructive?: boolean; silent?: boolean; action: () => Promise<void> }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.label} className={item.destructive ? "text-destructive" : ""} onClick={() => item.action().then(() => { if (!item.silent) toast.success(item.label); }).catch((err) => toast.error(String(err)))}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AsyncState({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => Promise<void> }) {
  if (loading) return <div className="h-full w-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (error) return <div className="flex items-center gap-2 py-4 text-sm text-destructive">{error}<Button variant="outline" size="sm" onClick={() => void onRetry()}><RefreshCcw className="h-4 w-4 mr-2" />Retry</Button></div>;
  return null;
}

function MachineDialog({ onChanged, machine, onOpenChange }: { onChanged: () => Promise<void>; machine?: Machine | null; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", auth_token: "" });
  useEffect(() => {
    if (machine) {
      setOpen(true);
      setForm({ name: machine.name, endpoint: machine.endpoint, auth_token: machine.auth_token ?? "" });
    }
  }, [machine]);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setForm({ name: "", endpoint: "", auth_token: "" });
      }
      onOpenChange?.(nextOpen);
    }}>
      {!machine && <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Custom Machine</Button></DialogTrigger>}
      <DialogContent>
        <DialogHeader><DialogTitle>{machine ? "Edit" : "Custom Machine"}</DialogTitle><DialogDescription>Add custom ComfyUI machines. For Basic Auth, put username:password in auth_token.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="https://comfy.example.com" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
          <Input type="password" placeholder="username:password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={async () => {
          await api(machine ? `/api/machines/${machine.id}` : "/api/machines", { method: machine ? "PATCH" : "POST", body: JSON.stringify({ ...form, type: machine?.type ?? "classic", status: machine?.status ?? "ready" }) });
          setForm({ name: "", endpoint: "", auth_token: "" });
          setOpen(false);
          await onChanged();
        }}>{machine ? <><Pencil className="mr-2 h-4 w-4" />Save</> : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function APIKeyDialog({ onChanged }: { onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setCreated("");
        setName("");
      }
    }}>
      <DialogTrigger asChild><Button>Create API Key</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create API Key</DialogTitle><DialogDescription>Create API Key for workflow upload</DialogDescription></DialogHeader>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        {created && <div className="grid gap-2"><div className="text-sm font-medium">API Key (Copy the API key now)</div><div className="flex items-center gap-2 rounded-md border p-2"><code className="truncate text-xs">{created}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(created)}><Copy className="h-4 w-4" /></Button></div></div>}
        <DialogFooter>
          {created ? (
            <Button type="button" onClick={() => setOpen(false)}>Close</Button>
          ) : (
            <Button disabled={saving} onClick={async () => {
              setSaving(true);
              try {
                const defaultName = name || "My API Key";
                const key = await api<APIKey>("/api/api-keys", { method: "POST", body: JSON.stringify({ name: defaultName }) });
                setCreated(key.key ?? "");
                setName(defaultName);
                await onChanged();
              } catch (error) {
                toast.error(String(error));
              } finally {
                setSaving(false);
              }
            }}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
