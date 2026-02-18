/**
 * API client for NVR Portal backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('access_token');
    if (stored) headers['Authorization'] = `Bearer ${stored}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { headers, ...rest });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// --- Auth ---
export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.set('username', email);
  form.set('password', password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || 'Login failed');
  }

  return res.json();
}

// --- Events ---
export function getEvents(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch(`/events${qs}`);
}

export function getEvent(id: string) {
  return apiFetch(`/events/${id}`);
}

export function syncEvents() {
  return apiFetch('/events/sync', { method: 'POST' });
}

export function getSnapshotUrl(eventId: string) {
  return `${API_BASE}/events/${eventId}/snapshot`;
}

export function getClipUrl(eventId: string) {
  return `${API_BASE}/events/${eventId}/clip`;
}

// --- Cameras ---
export function getCameras() {
  return apiFetch('/cameras');
}

// --- Users ---
export function getUsers() {
  return apiFetch('/users');
}

export function createUser(data: { email: string; password: string; role: string }) {
  return apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
}

// --- Evidence ---
export function exportEvidence(eventId: string, reason: string = '') {
  return apiFetch('/evidence/export', {
    method: 'POST',
    body: JSON.stringify({ event_id: eventId, reason }),
  });
}

export function getEvidenceList() {
  return apiFetch('/evidence');
}

export function getEvidenceManifest(evidenceId: string) {
  return apiFetch(`/evidence/${evidenceId}/manifest`);
}

// --- Audit ---
export function getAuditLog(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return apiFetch(`/audit${qs}`);
}

// --- Backups ---
export function getBackupRuns() {
  return apiFetch('/backups/runs');
}

// --- MFA ---
export function enrollMfa() {
  return apiFetch('/auth/mfa/totp/enroll', { method: 'POST' });
}

export function verifyMfa(code: string) {
  return apiFetch('/auth/mfa/totp/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// --- Health ---
export function healthCheck() {
  return apiFetch('/health');
}
