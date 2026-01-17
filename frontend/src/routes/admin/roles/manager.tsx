import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  fetchRoles,
  fetchPermissionTypes,
  fetchRolePermissionMappings,
  addRolePermission,
  removeRolePermission,
  type Role,
  type PermissionType,
  type RolePermissionMapping
} from '@/features/ontology/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Search,
  Plus,
  X,
  Settings2,
  Activity,
  Eye,
  LayoutDashboard
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AccessMatrix } from '@/features/rebac/components/AccessMatrix'
import { ImpactSimulator } from '@/features/rebac/components/ImpactSimulator';

// Updated route path
export const Route = createFileRoute('/admin/roles/manager')({
  component: RolesManagerPage,
})

function RolesManagerPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState<Role[]>([]);
  const [permTypes, setPermTypes] = useState<PermissionType[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [mappings, setMappings] = useState<RolePermissionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [fieldInput, setFieldInput] = useState<{ [permId: string]: string }>({});
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      loadRoleMappings(selectedRole.id);
    }
  }, [selectedRole]);

  async function loadInitialData() {
    try {
      const [rolesData, permsData] = await Promise.all([
        fetchRoles(),
        fetchPermissionTypes()
      ]);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPermTypes(Array.isArray(permsData) ? permsData.sort((a, b) => b.level - a.level) : []);
      if (Array.isArray(rolesData) && rolesData.length > 0) setSelectedRole(rolesData[0]);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load roles and permissions"
      });
      console.error('Detailed Load Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoleMappings(roleId: string) {
    try {
      const data = await fetchRolePermissionMappings(roleId);
      setMappings(data);

      // Sync field input state
      const initialFields: { [id: string]: string } = {};
      data.forEach(m => {
        if (m.field_name) initialFields[m.permission_type_id] = m.field_name;
      });
      setFieldInput(initialFields);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load role mappings"
      });
    }
  }

  async function handleTogglePermission(permType: PermissionType) {
    if (!selectedRole) return;

    const existing = mappings.find(m => m.permission_type_id === permType.id);
    const fieldName = fieldInput[permType.id];

    try {
      if (existing && !fieldName) {
        // Remove if no field constraint change
        await removeRolePermission(selectedRole.id, permType.name);
        setMappings(mappings.filter(m => m.permission_type_id !== permType.id));
      } else {
        // Add or update with field
        await addRolePermission(selectedRole.id, permType.name, fieldName);
        loadRoleMappings(selectedRole.id);
      }
      toast({
        title: "Success",
        description: `Updated ${permType.name} for ${selectedRole.name}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update role permission",
      });
    }
  }

  async function handleBulkAdd() {
    if (!selectedRole || selectedPermIds.size === 0) return;
    try {
      const promises = Array.from(selectedPermIds).map(id => {
        const type = permTypes.find(t => t.id === id);
        if (!type) return Promise.resolve();
        return addRolePermission(selectedRole.id, type.name, fieldInput[type.id]);
      });
      await Promise.all(promises);
      toast({ title: "Success", description: `Added ${selectedPermIds.size} permissions.` });
      setSelectedPermIds(new Set());
      loadRoleMappings(selectedRole.id);
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add permissions in bulk" });
    }
  }

  const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
  const filteredPerms = permTypes.filter(p =>
    p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
    p.description?.toLowerCase().includes(permSearch.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Activity className="animate-spin h-8 w-8 text-indigo-500" /></div>;

  return (
    <div className="h-[calc(100vh-320px)] min-h-[600px]">
      <Tabs defaultValue="standard" className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="standard">Standard View</TabsTrigger>
            <TabsTrigger value="matrix">Access Matrix (Global)</TabsTrigger>
            <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="impact" className="flex-1 overflow-hidden border rounded-xl p-4 bg-background/50">
          <ImpactSimulator roles={roles.map(r => ({ ...r, description: r.description ?? null }))} allPermissions={permTypes} />
        </TabsContent>

        <TabsContent value="matrix" className="flex-1 overflow-hidden border rounded-xl p-4 bg-background/50">
          <AccessMatrix />
        </TabsContent>

        <TabsContent value="standard" className="flex-1 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-8 h-full">
            {/* Left Side: Role List */}
            <div className="w-full md:w-80 flex flex-col space-y-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles..."
                  className="pl-8 bg-background/50 border-border/40"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl transition-all border duration-200",
                      selectedRole?.id === role.id
                        ? "bg-indigo-500/10 border-indigo-500/30 shadow-sm"
                        : "hover:bg-muted/50 border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Users className={cn(
                          "h-4 w-4",
                          selectedRole?.id === role.id ? "text-indigo-500" : "text-muted-foreground/50"
                        )} />
                        <span className="font-bold">{role.name}</span>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        selectedRole?.id === role.id ? "translate-x-0" : "-translate-x-2 opacity-0"
                      )} />
                    </div>
                    <p className="text-[10px] mt-1 line-clamp-1 opacity-70">
                      {role.description || "System role"}
                    </p>
                  </button>
                ))}
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => navigate({ to: '/admin/roles/designer' })}
                >
                  <Plus className="mr-2 h-4 w-4" /> New Role
                </Button>
              </div>
            </div>

            {/* Right Side: Permission Config */}
            <div className="flex-1 overflow-y-auto pr-2">
              {selectedRole ? (
                <Card className="border-border/40 bg-background/40 min-h-full">
                  <CardHeader className="border-b border-border/20 sticky top-0 bg-background/60 backdrop-blur-md z-10">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-black tracking-tight flex items-center space-x-2">
                          <Shield className="h-6 w-6 text-indigo-500" />
                          <span>{selectedRole.name}</span>
                        </CardTitle>
                        <CardDescription>{selectedRole.description || "Configure granular permissions for this role."}</CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-indigo-500/5 text-indigo-500 border-indigo-500/20 px-3">
                        Active Schema
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center">
                          <Settings2 className="mr-2 h-3 w-3" /> Capability Matrix
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-[10px]">
                                <Eye className="mr-2 h-3 w-3" /> Preview Menu
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[400px] h-[600px] flex flex-col p-0 overflow-hidden">
                              <div className="bg-muted/10 border-b p-4">
                                <h3 className="font-semibold">Menu Preview</h3>
                                <p className="text-xs text-muted-foreground">
                                  Simulating menu for role: <span className="font-bold text-foreground">{selectedRole.name}</span>
                                </p>
                              </div>
                              <div className="flex-1 overflow-hidden flex relative">
                                {/* Mock Sidebar Container */}
                                <div className="w-64 h-full border-r bg-background/50 relative">
                                  <div className="absolute inset-0 pointer-events-none z-10 bg-indigo-500/5" />
                                  <AdminSidebar previewPermissions={mappings.map(m => {
                                    const pt = permTypes.find(p => p.id === m.permission_type_id);
                                    return pt ? pt.name : '';
                                  })} />
                                </div>
                                <div className="flex-1 bg-muted/20 p-8 flex items-center justify-center text-center">
                                  <div>
                                    <LayoutDashboard className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-sm text-muted-foreground">Content Area</p>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <div className="relative w-48">
                            <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                            <Input
                              placeholder="Filter capabilities..."
                              className="pl-7 h-7 text-[10px] bg-background/40 border-border/40"
                              value={permSearch}
                              onChange={e => setPermSearch(e.target.value)}
                            />
                          </div>
                          {selectedPermIds.size > 0 && (
                            <Button size="sm" className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700" onClick={handleBulkAdd}>
                              Bulk Add ({selectedPermIds.size})
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {filteredPerms.map((type) => {
                          const mapping = mappings.find(m => m.permission_type_id === type.id);
                          const hasPerm = !!mapping;

                          return (
                            <div
                              key={type.id}
                              className={cn(
                                "group flex flex-col p-4 rounded-2xl border transition-all duration-300",
                                hasPerm
                                  ? "bg-indigo-500/[0.03] border-indigo-500/20"
                                  : "bg-muted/10 border-transparent opacity-80"
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4">
                                  <div className="mt-1 flex items-center space-x-3">
                                    {!hasPerm && (
                                      <Checkbox
                                        checked={selectedPermIds.has(type.id)}
                                        onCheckedChange={(checked) => {
                                          const next = new Set(selectedPermIds);
                                          if (checked) next.add(type.id);
                                          else next.delete(type.id);
                                          setSelectedPermIds(next);
                                        }}
                                      />
                                    )}
                                    <div className={cn(
                                      "rounded-full p-1",
                                      hasPerm ? "bg-indigo-500 text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                      {hasPerm ? <ShieldCheck className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-sm tracking-tight">{type.name}</span>
                                      <Badge variant="secondary" className="text-[10px] h-4 font-normal scale-90 origin-left">
                                        Level {type.level}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground max-w-md italic">
                                      {type.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  {hasPerm && (
                                    <div className="flex items-center space-x-2 bg-background/50 p-1 rounded-lg border border-border/20">
                                      <Label className="text-[10px] text-muted-foreground px-1 uppercase font-bold">Field</Label>
                                      <Input
                                        placeholder="All fields"
                                        className="h-7 w-32 text-xs border-none bg-transparent focus-visible:ring-0"
                                        value={fieldInput[type.id] || ''}
                                        onChange={(e) => setFieldInput({ ...fieldInput, [type.id]: e.target.value })}
                                      />
                                    </div>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={hasPerm ? "default" : "secondary"}
                                    className={cn(
                                      "h-8 rounded-lg text-xs font-bold transition-all",
                                      hasPerm ? "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20" : ""
                                    )}
                                    onClick={() => handleTogglePermission(type)}
                                  >
                                    {hasPerm ? "Active" : "Enable"}
                                  </Button>
                                </div>
                              </div>
                              {hasPerm && fieldInput[type.id] && (
                                <div className="mt-3 ml-12 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-center space-x-2">
                                  <ShieldAlert className="h-3 w-3 text-indigo-400" />
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                    Constrained to field: <strong className="font-mono">{fieldInput[type.id]}</strong>
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-border/40 rounded-3xl bg-muted/5 opacity-50">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium">Select a role to configure</h3>
                  <p className="text-sm text-muted-foreground">Choose a role from the left sidebar to start mapping permissions.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
