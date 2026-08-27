import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { ShieldCheck, Plus, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';

interface PermissionItem { id: string; module: string; action: string; description: string | null; }
interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissions: { permission: PermissionItem }[];
}

export const RbacManagement: React.FC = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        apiRequest<PermissionItem[]>('/rbac/permissions'),
        apiRequest<RoleItem[]>('/rbac/roles')
      ]);
      if (pRes.success && pRes.data) setPermissions(pRes.data);
      if (rRes.success && rRes.data) setRoles(rRes.data);
    } catch (err) {
      console.error('Failed to fetch RBAC configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/rbac/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: roleName.trim(),
          description: roleDesc.trim() || undefined
        })
      });

      if (res.success) {
        setShowRoleModal(false);
        setRoleName('');
        setRoleDesc('');
        fetchData();
      } else {
        alert(`Error creating custom role: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modules = Array.from(new Set(permissions.map(p => p.module)));

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roles & Permission Customization Matrix</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure tenant custom staff roles, toggle module permissions, and inspect system default role protections.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw size={14} /> Refresh Matrix
          </Button>
          <Button size="sm" onClick={() => setShowRoleModal(true)}>
            <Plus size={16} /> Create Custom Role
          </Button>
        </div>
      </div>

      {/* MODULE-ACTION PERMISSION MATRIX TABLE */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Module-Action Permission Matrix</CardTitle>
          <CardDescription>System default roles vs tenant custom staff roles</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SYSTEM MODULE</TableHead>
                {roles.map(r => (
                  <TableHead key={r.id} className="text-center">
                    <div className="font-bold text-slate-900">{r.name}</div>
                    {r.isSystemRole && <span className="text-[10px] text-slate-400 font-normal">System Role</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules.map(mod => (
                <TableRow key={mod}>
                  <TableCell className="font-bold text-slate-900 capitalize">{mod}</TableCell>
                  {roles.map(role => {
                    const hasModulePerm = role.permissions.some(p => p.permission.module === mod || p.permission.module === '*');
                    return (
                      <TableCell key={role.id} className="text-center">
                        {hasModulePerm ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 mx-auto">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CREATE CUSTOM ROLE MODAL */}
      <Dialog
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Create Custom Staff Role"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRole} className="space-y-4">
          <Input
            label="Role Name"
            required
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. Senior Dispatch Supervisor"
          />

          <Input
            label="Description"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            placeholder="e.g. Full access to routes, customers, and order dispatching"
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setShowRoleModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Role
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
