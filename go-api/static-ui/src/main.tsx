import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster, toast } from "sonner";
import { ArrowUpDown, Copy, Loader2, MoreHorizontal, Plus, RefreshCcw } from "lucide-react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { api, APIKey, Deployment, Machine, navigate, Run, WorkflowItem, WorkflowVersion } from "./api";
import { useResource } from "./hooks";
import { Navbar } from "./components/Navbar";
import { AuthRequest } from "./authRequest";
import { DocsPage } from "./docsPage";
import { MachineDetail } from "./machineDetail";
import { SharePage } from "./sharePage";
import { ShareSettings } from "./shareSettings";
import { WorkflowDetail } from "./workflowDetail";
import { getRelativeTime } from "./lib/getRelativeTime";
import { Badge } from "./components/ui/badge";
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
import { TooltipProvider } from "./components/ui/tooltip";
import "./globals.css";

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

  if (grantMatch) return <AuthRequest requestID={decodeURIComponent(grantMatch[1])} />;
  if (shareSettingsMatch) return <Shell><ShareSettings shareID={decodeURIComponent(shareSettingsMatch[1])} /></Shell>;
  if (shareMatch) return <SharePage shareID={decodeURIComponent(shareMatch[1])} />;
  if (workflowMatch) return <Shell><WorkflowDetail workflowID={decodeURIComponent(workflowMatch[1])} /></Shell>;
  if (machineMatch) return <Shell><MachineDetail machineID={decodeURIComponent(machineMatch[1])} /></Shell>;
  if (["/examples", "/docs", "/docs/install", "/docs/endpoints"].includes(path)) return <Shell><DocsPage path={path === "/docs" ? "/docs/install" : path} /></Shell>;
  if (path === "/machines") return <Shell><MachinesPage /></Shell>;
  if (path === "/api-keys") return <Shell><APIKeysPage /></Shell>;
  return <Shell><WorkflowsPage /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
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
        <Toaster richColors />
      </main>
    </TooltipProvider>
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
          <Badge variant="default">v{row.original.versions?.[0]?.version ?? "-"}</Badge>
          {row.original.deployments?.[0] && <Badge variant="success">Public</Badge>}
        </a>
      ),
    },
    { accessorKey: "creator", header: ({ column }) => <SortButton column={column} label="Creator" />, cell: ({ row }) => <Badge variant="cyan">{row.original.user?.name ?? "Local Admin"}</Badge> },
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
  const columns = useMemo<ColumnDef<Machine>[]>(() => [
    selectColumn<Machine>(),
    {
      accessorKey: "name",
      header: ({ column }) => <SortButton column={column} label="Name" />,
      cell: ({ row }) => (
        <div className="flex flex-row gap-2 items-center truncate">
          <a href={`/machines/${row.original.id}`} onClick={(event) => route(event, `/machines/${row.original.id}`)} className="hover:underline">{row.original.name}</a>
          {row.original.disabled && <Badge variant="destructive">Disabled</Badge>}
          {row.original.status === "building" && <Badge variant="amber" className="capitalize">building <Loader2 className="ml-1 h-3 w-3 animate-spin" /></Badge>}
          {!row.original.disabled && row.original.status && <Badge variant={row.original.status === "ready" ? "success" : "destructive"} className="capitalize">{row.original.status}</Badge>}
        </div>
      ),
    },
    { accessorKey: "endpoint", header: () => <div className="text-left">Endpoint</div>, cell: ({ row }) => <div className="text-left font-medium truncate max-w-[400px]">{row.original.endpoint}</div> },
    { accessorKey: "type", header: () => <div className="text-left">Type</div>, cell: ({ row }) => <div className="text-left font-medium truncate">{row.original.type}</div> },
    { accessorKey: "date", sortingFn: "datetime", header: ({ column }) => <SortButton column={column} label="Update Date" right />, cell: ({ row }) => <div className="capitalize text-right">{getRelativeTime(row.original.updated_at)}</div> },
    { id: "actions", cell: ({ row }) => <RowMenu items={[{ label: "Disable Machine", destructive: true, action: async () => { await api(`/api/machines/${row.original.id}`, { method: "DELETE" }); await onChanged(); } }]} /> },
  ], [onChanged]);
  return (
    <>
      <div className="flex items-center py-4">
        <MachineDialog onChanged={onChanged} />
      </div>
      <DataTable data={data} columns={columns} filterColumn="name" filterPlaceholder="Filter machines..." />
    </>
  );
}

function APIKeysPage() {
  const keys = useResource<APIKey[]>("/api/api-keys");
  const data = (keys.data ?? []).map((item) => ({ ...item, endpoint: "Bearer token", date: item.created_at }));
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
    { accessorKey: "date", sortingFn: "datetime", header: ({ column }) => <SortButton column={column} label="Update Date" right />, cell: ({ row }) => <div className="capitalize text-right">{getRelativeTime(row.original.created_at)}</div> },
    { id: "actions", cell: ({ row }) => <RowMenu items={[{ label: "Delete API Key", destructive: true, action: async () => { await api(`/api/api-keys/${row.original.id}`, { method: "DELETE" }); await onChanged(); } }]} /> },
  ], [onChanged]);
  return (
    <>
      <div className="flex items-center py-4">
        <APIKeyDialog onChanged={onChanged} />
      </div>
      <DataTable data={data} columns={columns} filterColumn="name" filterPlaceholder="Filter keys..." />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

function route(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
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

function RowMenu({ items }: { items: { label: string; destructive?: boolean; action: () => Promise<void> }[] }) {
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
          <DropdownMenuItem key={item.label} className={item.destructive ? "text-destructive" : ""} onClick={() => item.action().then(() => toast.success(item.label)).catch((err) => toast.error(String(err)))}>
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

function MachineDialog({ onChanged }: { onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", auth_token: "" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Custom Machine</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Custom Machine</DialogTitle><DialogDescription>Add custom ComfyUI machines. For Basic Auth, put username:password in auth_token.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="https://comfy.example.com" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} />
          <Input type="password" placeholder="username:password" value={form.auth_token} onChange={(e) => setForm({ ...form, auth_token: e.target.value })} />
        </div>
        <DialogFooter><Button onClick={async () => { await api("/api/machines", { method: "POST", body: JSON.stringify({ ...form, type: "classic", status: "ready" }) }); setOpen(false); await onChanged(); }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function APIKeyDialog({ onChanged }: { onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New API Key</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New API Key</DialogTitle><DialogDescription>Create an API key for programmatic workflow runs.</DialogDescription></DialogHeader>
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        {created && <div className="flex items-center gap-2 rounded-md border p-2"><code className="truncate text-xs">{created}</code><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(created)}><Copy className="h-4 w-4" /></Button></div>}
        <DialogFooter><Button onClick={async () => { const key = await api<APIKey>("/api/api-keys", { method: "POST", body: JSON.stringify({ name }) }); setCreated(key.key ?? ""); await onChanged(); }}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
