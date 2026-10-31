import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { type FormEvent, useState } from 'react';
import { ErrorBanner, Field, Modal, PageHead } from '../components/ui';
import { taxesApi } from '../lib/api';
import { useAction } from '../lib/hooks';
import { queryClient } from '../lib/queryClient';

interface Tax {
  id: string;
  name: string;
  rate: number;
}

interface TaxFormData {
  name: string;
  rate: number;
}

function TaxForm({ initial, onClose }: { initial: Tax | null; onClose: () => void }) {
  const { error: actionError, run } = useAction();
  const [f, setF] = useState<TaxFormData>({
    name: initial?.name ?? '',
    rate: initial?.rate ?? 0,
  });
  const [apiError, setApiError] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => taxesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setApiError(e.response?.data?.detail ?? e.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      taxesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxes'] });
      onClose();
    },
    onError: (err) => {
      const e = err as AxiosError<{ detail?: string }>;
      setApiError(e.response?.data?.detail ?? e.message);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setApiError('');
    run(() => {
      const payload: Record<string, unknown> = {
        name: f.name,
        rate: f.rate,
      };
      if (initial?.id) {
        updateMutation.mutate({ id: initial.id, payload });
      } else {
        createMutation.mutate(payload);
      }
    });
  };

  const displayError = apiError || actionError;

  return (
    <Modal title={initial?.name ? 'Edit tax' : 'New tax'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Name">
          <input
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            autoFocus
            required
          />
        </Field>
        <Field label="Rate (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={f.rate}
            onChange={(e) => setF({ ...f, rate: Number(e.target.value) })}
            required
          />
        </Field>
        {displayError && <ErrorBanner error={displayError} />}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Taxes() {
  const [editing, setEditing] = useState<Tax | null | 'new'>(null);

  const {
    data: taxes,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesApi.list().then((r) => r.data as Tax[]),
  });

  const apiError = queryError
    ? ((queryError as AxiosError<{ detail?: string }>).response?.data?.detail ??
      (queryError as Error).message)
    : '';

  return (
    <>
      <PageHead title="Taxes" sub="Rules used to calculate tax on every invoice automatically">
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + New tax
        </button>
      </PageHead>

      {apiError && <ErrorBanner error={apiError} />}

      <div className="card table-wrap">
        {isLoading ? (
          <p className="muted" style={{ padding: '1rem' }}>
            Loading…
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Rate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(taxes ?? []).map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td className="num">{t.rate}%</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(t)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing !== null && (
        <TaxForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
