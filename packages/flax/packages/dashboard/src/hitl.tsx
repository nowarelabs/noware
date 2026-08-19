import { Badge, Button, InputGroup } from '@cloudflare/kumo';
import { CheckCircle, ShieldCheck, UserFocus, WarningOctagon } from '@phosphor-icons/react';
import { useState } from 'react';

import { resolveHitl } from './api';
import type { HitlField, HitlOption, HitlPayload, HitlRow, HitlType } from './types';
import { HITL_TYPE_LABELS } from './types';

function parsePayload(payload: string | null): HitlPayload {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? (parsed as HitlPayload) : {};
  } catch {
    return {};
  }
}

function severityVariant(severity?: string): 'success' | 'warning' | 'error' | 'secondary' {
  if (severity === 'critical') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'success';
  return 'secondary';
}

function typeIcon(type: HitlType) {
  switch (type) {
    case 'pr-review':
      return <ShieldCheck size={16} weight="duotone" />;
    case 'alert':
      return <WarningOctagon size={16} weight="duotone" />;
    default:
      return <UserFocus size={16} weight="duotone" />;
  }
}

export function HitlWidget({ hitl, onResolved, disabled }: { hitl: HitlRow; onResolved: (id: string) => void; disabled?: boolean }) {
  const payload = parsePayload(hitl.payload);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async (resolution: Record<string, unknown>, note?: string) => {
    setBusy(true);
    setError(null);
    try {
      await resolveHitl(hitl.id, resolution, note);
      onResolved(hitl.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cf-hitl" data-severity={payload.severity ?? 'info'} data-status={hitl.status}>
      <div className="head">
        <span className="icon">{typeIcon(hitl.type)}</span>
        <div className="titles">
          <div className="title">{hitl.title}</div>
          <div className="sub">
            <Badge variant={hitl.status === 'pending' ? 'warning' : 'success'}>{hitl.status}</Badge>
            <span className="type">{HITL_TYPE_LABELS[hitl.type] ?? hitl.type}</span>
            {payload.severity ? <Badge variant={severityVariant(payload.severity)}>{payload.severity}</Badge> : null}
            {payload.prRef ? <span className="mono pr">{payload.prRef}</span> : null}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {hitl.status === 'pending' ? <span className="pending-pulse" /> : <CheckCircle size={15} className="done-check" />}
      </div>

      {hitl.summary ? <div className="summary">{hitl.summary}</div> : null}
      {hitl.resolution ? (
        <div className="resolution">
          <span className="lbl">Resolved</span>
          <span className="val mono">{hitl.resolution}</span>
        </div>
      ) : null}

      {hitl.status === 'pending' && !disabled ? (
        <WidgetBody
          type={hitl.type}
          payload={payload}
          busy={busy}
          onResolve={resolve}
        />
      ) : null}

      {error ? <div className="err">{error}</div> : null}
    </div>
  );
}

function WidgetBody({
  type,
  payload,
  busy,
  onResolve,
}: {
  type: HitlType;
  payload: HitlPayload;
  busy: boolean;
  onResolve: (resolution: Record<string, unknown>, note?: string) => Promise<void>;
}) {
  switch (type) {
    case 'approve-reject':
      return (
        <div className="actions">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void onResolve({ approved: true })}>
            Approve
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => void onResolve({ approved: false })}>
            Reject
          </Button>
        </div>
      );
    case 'pr-review':
      return (
        <div className="actions column">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void onResolve({ approved: true, action: 'merge' }, 'approved, merge requested')}>
            Approve &amp; merge
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void onResolve({ approved: false, action: 'changes' }, 'changes requested')}>
            Request changes
          </Button>
        </div>
      );
    case 'choose-option':
      return <ChooseOption options={payload.options ?? []} busy={busy} onResolve={onResolve} />;
    case 'structured-form':
      return <StructuredForm fields={payload.fields ?? []} busy={busy} onResolve={onResolve} />;
    case 'alert':
      return (
        <div className="actions">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void onResolve({ acknowledged: true })}>
            Acknowledge
          </Button>
        </div>
      );
    default:
      return null;
  }
}

function ChooseOption({
  options,
  busy,
  onResolve,
}: {
  options: HitlOption[];
  busy: boolean;
  onResolve: (resolution: Record<string, unknown>, note?: string) => Promise<void>;
}) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="options">
      {options.length === 0 ? (
        <input
          className="cf-hitl-input"
          placeholder="Type your answer…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
              void onResolve({ value: (e.target as HTMLInputElement).value.trim() });
            }
          }}
        />
      ) : (
        options.map((opt) => (
          <label key={opt.value} className="option" data-selected={value === opt.value}>
            <input
              type="radio"
              name="choose-option"
              checked={value === opt.value}
              onChange={() => setValue(opt.value)}
            />
            <span className="lbl">{opt.label}</span>
            {opt.detail ? <span className="detail">{opt.detail}</span> : null}
          </label>
        ))
      )}
      {options.length > 0 ? (
        <div className="actions">
          <Button variant="primary" size="sm" disabled={busy || !value} onClick={() => value && void onResolve({ value })}>
            Confirm
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StructuredForm({
  fields,
  busy,
  onResolve,
}: {
  fields: HitlField[];
  busy: boolean;
  onResolve: (resolution: Record<string, unknown>, note?: string) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const missing = fields.some((f) => f.required && (values[f.name] === undefined || values[f.name] === ''));
  return (
    <div className="form">
      {fields.map((field) => (
        <label key={field.name} className="field">
          <span className="lbl">
            {field.label}
            {field.required ? <span className="req"> *</span> : null}
          </span>
          {field.type === 'textarea' ? (
            <textarea
              className="cf-hitl-input"
              rows={3}
              placeholder={field.placeholder}
              value={(values[field.name] as string) ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            />
          ) : field.type === 'select' ? (
            <select
              className="cf-hitl-input"
              value={(values[field.name] as string) ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            >
              <option value="">Select…</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === 'toggle' ? (
            <input
              type="checkbox"
              checked={Boolean(values[field.name])}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
            />
          ) : (
            <InputGroup>
              <InputGroup.Input
                placeholder={field.placeholder}
                value={(values[field.name] as string) ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              />
            </InputGroup>
          )}
        </label>
      ))}
      <div className="actions">
        <Button variant="primary" size="sm" disabled={busy || missing} onClick={() => void onResolve(values)}>
          Submit
        </Button>
      </div>
    </div>
  );
}
