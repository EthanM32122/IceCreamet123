import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DownloadSource() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="bg-card text-card-foreground border border-border rounded-xl p-6 max-w-lg space-y-4">
        <h1 className="text-2xl font-heading">Download ICECREAMET</h1>
        <p>Download the project files together in one ZIP, then unzip it and upload the contents to your GitHub repository.</p>
        <Button asChild><a href="/icecreamet-source.zip" download="icecreamet-source.zip"><Download /> Download all project files</a></Button>
        <p className="text-sm text-muted-foreground">Includes the public hosting settings and instructions. No passwords, private keys, or player records are included. The frontend still connects to Base44 for accounts, data, and backend functions.</p>
      </section>
    </main>
  );
}