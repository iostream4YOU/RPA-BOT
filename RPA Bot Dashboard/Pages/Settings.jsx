import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage your application preferences and configurations.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the dashboard looks on your device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Moon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                   <p className="font-medium">Dark Mode</p>
                   <p className="text-sm text-slate-500">Adjust the theme to reduce eye strain.</p>
                </div>
              </div>
              {/* Note: The actual toggle logic is in Layout.js, this is just a UI mock for the settings page 
                  functionality usually would sync with global state/context 
              */}
              <Button variant="outline" disabled>Controlled in Sidebar</Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure how you want to receive alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-slate-500" />
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Alerts</Label>
                    <p className="text-sm text-slate-500">Receive a daily summary of failed audits.</p>
                  </div>
               </div>
               <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-slate-500" />
                  <div className="space-y-0.5">
                    <Label className="text-base">Security Alerts</Label>
                    <p className="text-sm text-slate-500">Notify me of unusual login activity.</p>
                  </div>
               </div>
               <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>Manage your API keys and endpoints.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input defaultValue="https://api.rpa-control.com/v1/analytics" readOnly className="font-mono bg-slate-50 dark:bg-slate-900" />
            </div>
             <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input type="password" value="sk_live_xxxxxxxxxxxxxxxxx" readOnly className="font-mono bg-slate-50 dark:bg-slate-900" />
                <Button variant="secondary">Regenerate</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
           <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
        </div>
      </div>
    </div>
  );
}