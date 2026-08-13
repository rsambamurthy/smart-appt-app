import { useEffect, useRef, useState, CSSProperties } from 'react';
import {
  useAskMutation, useConfirmAssistantActionMutation, useCancelAssistantActionMutation,
} from '../../store/api/assistantApi';

/**
 * The in-app assistant.
 *
 * Two things in here are not decoration.
 *
 * A proposed action renders as a card with Confirm and Cancel, never as a
 * sentence claiming the thing was done. The server will not execute without
 * that tap, and the interface should not imply otherwise.
 *
 * Where an answer came from is shown under it. "Late payment penalties are
 * included" is a claim; "from your statement of account" is a claim you can
 * check. Given the assistant is quoting money at people, the second matters.
 */

interface Turn {
  id:      string;
  who:     'you' | 'assistant';
  text:    string;
  tools?:  string[];
  action?: { action: string; summary: string } | null;
  status?: 'PENDING' | 'DONE' | 'CANCELLED' | 'FAILED';
}

const TOOL_LABELS: Record<string, string> = {
  my_profile:             'your registration details',
  find_feature:           'your app menu',
  explain_term:           'the SmartAppt glossary',
  how_it_works:           'the SmartAppt guide',
  ledger_balance:         'the ledger',
  my_dues_summary:        'your current dues',
  my_statement:           'your statement of account',
  my_bills:               'your bills',
  my_payment_claims:      'your reported payments',
  my_tickets:             'your complaints',
  my_visitors:            'your visitors',
  collection_summary:     'the association collection summary',
  arrears_list:           'the arrears list',
  dues_dashboard:         'the dues dashboard',
  pending_payment_claims: 'payments awaiting confirmation',
  tickets_dashboard:      'the complaints dashboard',
  unit_statement:         'that flat\'s statement',
};

/**
 * Strip markdown the panel cannot render.
 *
 * The system prompt asks for plain text and the model mostly complies, but
 * "mostly" shows up as literal **Cash Balance:** in front of a resident. This
 * is the belt to that prompt's braces: cheap, local, and it cannot make the
 * text worse. Rendering markdown properly would mean a parser and a sanitiser
 * for output that is two sentences long — not worth the surface area.
 */
const plain = (s: string) =>
  s.replace(/\*\*(.+?)\*\*/g, '$1')     // bold
   .replace(/(^|\s)\*(\S.*?\S)\*/g, '$1$2')  // italics, but not a bullet's "* "
   .replace(/^#{1,6}\s+/gm, '')          // headers
   .replace(/`{1,3}/g, '')               // code fences and inline code
   .replace(/^\s*[-*]\s+/gm, '• ');      // list markers to a real bullet

const bubble = (mine: boolean): CSSProperties => ({
  alignSelf: mine ? 'flex-end' : 'flex-start',
  maxWidth: '85%',
  background: mine ? '#1e293b' : '#f1f5f9',
  color: mine ? '#fff' : '#0f172a',
  padding: '9px 13px',
  borderRadius: 14,
  borderBottomRightRadius: mine ? 4 : 14,
  borderBottomLeftRadius: mine ? 14 : 4,
  fontSize: 14,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
});

const btn: CSSProperties = {
  padding: '7px 13px', borderRadius: 8, fontSize: 13,
  fontWeight: 600, cursor: 'pointer', border: '1px solid transparent',
};

const SUGGESTIONS = [
  'What do I owe right now?',
  'How do I raise a complaint?',
  'What is a levy?',
];

export default function AssistantChat({ onClose }: { onClose?: () => void }) {
  const [turns, setTurns]   = useState<Turn[]>([]);
  const [draft, setDraft]   = useState('');
  const [convoId, setConvo] = useState<string | undefined>();
  const [error, setError]   = useState('');

  const [ask, { isLoading }] = useAskMutation();
  const [confirmAction]      = useConfirmAssistantActionMutation();
  const [cancelAction]       = useCancelAssistantActionMutation();

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, isLoading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || isLoading) return;
    setError('');
    setDraft('');
    setTurns(t => [...t, { id: `u-${Date.now()}`, who: 'you', text: message }]);

    try {
      const res = await ask({ message, conversation_id: convoId }).unwrap();
      const d = res.data;
      setConvo(d.conversation_id);
      setTurns(t => [...t, {
        id: d.message_id, who: 'assistant', text: d.answer,
        tools: d.used_tools, action: d.proposed_action,
        status: d.proposed_action ? 'PENDING' : undefined,
      }]);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'The assistant could not answer just now.');
    }
  };

  const decide = async (messageId: string, go: boolean) => {
    try {
      if (go) await confirmAction(messageId).unwrap();
      else    await cancelAction(messageId).unwrap();
      setTurns(t => t.map(x => x.id === messageId
        ? { ...x, status: go ? 'DONE' : 'CANCELLED' } : x));
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setTurns(t => t.map(x => x.id === messageId ? { ...x, status: 'FAILED' } : x));
      setError(detail ?? 'That did not go through.');
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden',
    }}>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a' }}>Phoebe</div>
          <div style={{ fontSize: 11.5, color: '#64748b' }}>Answers from your association&rsquo;s live records</div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close"
                  style={{ ...btn, background: 'transparent', color: '#64748b', fontSize: 18, padding: '2px 8px' }}>
            ×
          </button>
        )}
      </div>

      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {turns.length === 0 && (
          <div style={{ color: '#64748b', fontSize: 13.5 }}>
            <p style={{ marginTop: 0 }}>
              I&rsquo;m Phoebe. Ask me about your dues, statement, complaints or visitors,
              or how to do something in SmartAppt.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                        style={{ ...btn, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map(t => (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={bubble(t.who === 'you')}>
              {t.who === 'assistant' ? plain(t.text) : t.text}
            </div>

            {/* Where the figures came from. */}
            {t.who === 'assistant' && !!t.tools?.length && (
              <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 4 }}>
                from {t.tools.map(x => TOOL_LABELS[x] ?? x).join(', ')}
              </div>
            )}

            {/* Nothing happens until this is tapped. */}
            {t.action && (
              <div style={{
                border: '1px solid #cbd5e1', borderRadius: 10, padding: 12,
                background: '#f8fafc', maxWidth: '85%',
              }}>
                <div style={{ fontSize: 13, color: '#0f172a', marginBottom: 9 }}>{t.action.summary}</div>
                {t.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => decide(t.id, true)}
                            style={{ ...btn, background: '#1e293b', color: '#fff' }}>
                      Confirm
                    </button>
                    <button onClick={() => decide(t.id, false)}
                            style={{ ...btn, background: '#fff', color: '#475569', borderColor: '#cbd5e1' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 12.5, fontWeight: 600,
                    color: t.status === 'DONE' ? '#15803d'
                         : t.status === 'FAILED' ? '#b91c1c' : '#64748b',
                  }}>
                    {t.status === 'DONE' ? 'Done' : t.status === 'FAILED' ? 'Did not go through' : 'Cancelled'}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ ...bubble(false), color: '#94a3b8' }}>Looking that up…</div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div style={{ padding: '9px 16px', background: '#fef2f2', color: '#b91c1c', fontSize: 12.5 }}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); void send(draft); }}
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e2e8f0' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Phoebe…"
          style={{
            flex: 1, padding: '10px 13px', borderRadius: 9,
            border: '1px solid #cbd5e1', fontSize: 14, outline: 'none',
          }}
        />
        <button type="submit" disabled={isLoading || !draft.trim()}
                style={{
                  ...btn, background: draft.trim() ? '#1e293b' : '#e2e8f0',
                  color: draft.trim() ? '#fff' : '#94a3b8', padding: '10px 16px',
                }}>
          Send
        </button>
      </form>
    </div>
  );
}
