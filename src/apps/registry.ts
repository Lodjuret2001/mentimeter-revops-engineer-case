/**
 * The apps in the sidebar. Add your own here: give it an id, a label, a path
 * and an icon from lucide-react, and create the page under src/app/(shell).
 */
import {
  Building2,
  CreditCard,
  FileText,
  Handshake,
  Home,
  LayoutGrid,
  MessageSquare,
  Workflow,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface AppEntry {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export interface AppSection {
  label: string;
  apps: AppEntry[];
}

export const APP_SECTIONS: AppSection[] = [
  {
    label: 'MentOS',
    apps: [
      { id: 'home', label: 'Home', href: '/', icon: Home },
      { id: 'orchestrator', label: 'Menti Orchestrator', href: '/orchestrator', icon: Workflow },
    ],
  },
  {
    label: 'Salesforce',
    apps: [
      { id: 'deals', label: 'Deals', href: '/deals', icon: Handshake },
      { id: 'accounts', label: 'Accounts', href: '/accounts', icon: Building2 },
    ],
  },
  {
    label: 'Systems',
    apps: [
      { id: 'admin-app', label: 'Admin app', href: '/admin-app', icon: LayoutGrid },
      { id: 'kleer', label: 'Kleer', href: '/kleer', icon: FileText },
      { id: 'stripe', label: 'Stripe', href: '/stripe', icon: CreditCard },
      { id: 'slack', label: 'Slack', href: '/slack', icon: MessageSquare },
    ],
  },
  {
    label: 'Developer',
    apps: [{ id: 'dev', label: 'Dev tools', href: '/dev', icon: Wrench }],
  },
];
