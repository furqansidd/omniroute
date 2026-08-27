import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { Bell, Plus, Send, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';

interface TemplateItem {
  id: string;
  name: string;
  eventTrigger: string;
  channel: string;
  body: string;
  status: string;
}

interface MessageLogItem {
  id: string;
  recipientPhone: string;
  channel: string;
  body: string;
  status: string;
  sentAt: string;
}

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [logs, setLogs] = useState<MessageLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tRes, lRes] = await Promise.all([
        apiRequest<TemplateItem[]>('/notifications/templates'),
        apiRequest<MessageLogItem[]>('/notifications/logs')
      ]);
      if (tRes.success && tRes.data) setTemplates(tRes.data);
      if (lRes.success && lRes.data) setLogs(lRes.data);
    } catch (err) {
      console.error('Failed to fetch notification data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">SMS & WhatsApp Notification Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated message templates, tag interpolations, and inspect message dispatch logs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} isLoading={isLoading}>
          <RefreshCw size={14} /> Refresh Logs
        </Button>
      </div>

      {/* TEMPLATES TABLE */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Configured Event Message Templates ({templates.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TEMPLATE NAME</TableHead>
              <TableHead>EVENT TRIGGER</TableHead>
              <TableHead>CHANNEL</TableHead>
              <TableHead>MESSAGE BODY TEMPLATE</TableHead>
              <TableHead>STATUS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-bold text-slate-900">{t.name}</TableCell>
                <TableCell className="text-xs font-mono font-semibold text-brand-600">{t.eventTrigger}</TableCell>
                <TableCell className="text-xs uppercase font-bold text-slate-700">{t.channel}</TableCell>
                <TableCell className="text-xs text-slate-600 max-w-md truncate font-mono">{t.body}</TableCell>
                <TableCell>
                  <Badge variant={t.status === 'active' ? 'emerald' : 'slate'}>
                    {t.status.toUpperCase()}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* DISPATCH AUDIT LOGS TABLE */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Recent Message Dispatch Audit Stream ({logs.length})</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>RECIPIENT PHONE</TableHead>
              <TableHead>CHANNEL</TableHead>
              <TableHead>SENT BODY</TableHead>
              <TableHead>STATUS</TableHead>
              <TableHead>SENT TIMESTAMP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-bold text-slate-900">{l.recipientPhone}</TableCell>
                <TableCell className="text-xs uppercase font-semibold text-slate-700">{l.channel}</TableCell>
                <TableCell className="text-xs text-slate-600 max-w-md truncate">{l.body}</TableCell>
                <TableCell>
                  <Badge variant={l.status === 'sent' ? 'emerald' : 'rose'}>
                    {l.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-500">{new Date(l.sentAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
