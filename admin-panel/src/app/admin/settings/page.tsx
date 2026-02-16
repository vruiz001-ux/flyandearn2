'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 mt-1">Admin panel configuration</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Account</CardTitle>
            <CardDescription>Manage your admin credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Current Username</label>
                <input type="text" disabled value="admin" className="input-field opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                <input type="password" placeholder="Enter new password" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <input type="password" placeholder="Confirm new password" className="input-field" />
              </div>
              <button className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Configure security options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium">Rate Limiting</p>
                  <p className="text-sm text-gray-400">Limit login attempts per IP</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium">Audit Logging</p>
                  <p className="text-sm text-gray-400">Log all admin actions</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-gray-400">Auto-logout after inactivity</p>
                </div>
                <select className="input-field w-32">
                  <option value="4">4 hours</option>
                  <option value="8" selected>8 hours</option>
                  <option value="24">24 hours</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics Tracking</CardTitle>
            <CardDescription>First-party analytics configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium">Track Pageviews</p>
                  <p className="text-sm text-gray-400">Collect anonymous pageview data</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>
              <div className="p-4 bg-gold-500/10 border border-gold-500/30 rounded-lg">
                <p className="text-sm text-gold-500 font-medium">Tracking Script</p>
                <p className="text-xs text-gray-400 mt-1 mb-2">Add this to your main site to enable first-party analytics:</p>
                <code className="block p-2 bg-black/30 rounded text-xs text-gray-300 overflow-x-auto">
                  {`<script src="/api/track/script.js" async></script>`}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export and maintenance options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <button className="btn-secondary w-full">Export All Data (CSV)</button>
              <button className="btn-secondary w-full">Clean Old Login Attempts (30+ days)</button>
              <button className="btn-danger w-full">Clear Analytics Data</button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
