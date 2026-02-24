export type CreateClientInput = {
  uid: string;
  name: string;
  project: string;
  totalProjectCost: number;
  currency: string;
};

export async function listClients(uid: string) {
  const res = await fetch('/api/clients', {
    method: 'GET',
    headers: { 'x-user-id': uid },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return (json.data || []) as any[];
}

export async function createClient(input: CreateClientInput) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.data as any;
}

export async function deleteClient(uid: string, id: string) {
  // uid unused server-side currently; kept for parity
  const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export type CreatePaymentInput = {
  uid: string;
  clientId: string;
  amount: number;
  paymentDate: string; // ISO
  currency: string;
  notes?: string;
};

export async function listPayments(uid: string) {
  const res = await fetch('/api/payments', {
    method: 'GET',
    headers: { 'x-user-id': uid },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return (json.data || []) as any[];
}

export async function createPayment(input: CreatePaymentInput) {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.data as any;
}

export async function deletePayment(id: string) {
  const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

