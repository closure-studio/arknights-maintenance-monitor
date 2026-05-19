export type ClassificationStatus = "maintenance" | "not_maintenance" | "uncertain";

export interface NewsLink {
  id: string;
  url: string;
}

export interface NewsDetail extends NewsLink {
  title: string;
  content: string;
}

export interface MaintenanceTime {
  start: string | null;
  end: string | null;
  raw: string | null;
}

export interface ClassificationResult {
  status: ClassificationStatus;
  isMaintenance: boolean;
  reason: string;
  summary: string;
  maintenanceStart: string | null;
  maintenanceEnd: string | null;
  confidence?: number;
}

export interface NotifyResult {
  notified: boolean;
  notifyChannel: "qqbot" | null;
  notifyError: string | null;
}

export interface ProcessedRecord {
  url: string;
  title: string;
  first_seen_at: string;
  last_seen_at: string;
  is_maintenance: boolean;
  notified: boolean;
  notify_channel: "qqbot" | null;
  reason: string;
  summary: string;
  notify_error: string | null;
}

export interface ProcessedState {
  version: 1;
  last_check: string | null;
  processed: Record<string, ProcessedRecord>;
}
