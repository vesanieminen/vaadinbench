import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useBlocker } from 'react-router';

type Fields = { name: string; email: string; phone: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;
type Message = Fields;

const EMPTY: Fields = { name: '', email: '', phone: '', message: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 500;

export function validate(fields: Fields): Errors {
  const errors: Errors = {};
  const email = fields.email.trim();
  if (!fields.name.trim()) errors.name = 'Name is required';
  if (email && !EMAIL.test(email)) errors.email = 'Enter a valid e-mail address';
  else if (!email && !fields.phone.trim()) errors.email = 'Give an e-mail address or a phone number';
  if (!fields.message.trim()) errors.message = 'Message is required';
  else if (fields.message.length > MAX_MESSAGE) errors.message = 'Message must be at most 500 characters';
  return errors;
}

export default function ContactView() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [justSent, setJustSent] = useState(false);
  const [notice, setNotice] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const form = useRef<HTMLFormElement>(null);

  const dirty = Object.values(fields).some((value) => value !== '');
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(false), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  function edit(field: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setJustSent(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (justSent) return;
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const sent: Message = fields;
    setMessages((current) => [sent, ...current]);
    setFields(EMPTY);
    setJustSent(true);
    setNotice(true);
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.current?.requestSubmit();
    }
  }

  return (
    <main>
      <h1>Contact</h1>
      <nav>
        <Link to="/about">About</Link>
      </nav>

      <form ref={form} onSubmit={send} noValidate>
        <Field label="Name" error={errors.name}>
          {(props) => <input type="text" value={fields.name} onChange={(e) => edit('name', e.target.value)} {...props} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {(props) => <input type="email" value={fields.email} onChange={(e) => edit('email', e.target.value)} {...props} />}
        </Field>
        <Field label="Phone" error={errors.phone}>
          {(props) => <input type="tel" value={fields.phone} onChange={(e) => edit('phone', e.target.value)} {...props} />}
        </Field>
        <Field label="Message" error={errors.message}>
          {(props) => (
            <textarea value={fields.message} onChange={(e) => edit('message', e.target.value)} onKeyDown={sendOnEnter} {...props} />
          )}
        </Field>
        <button type="submit" disabled={justSent}>
          Send
        </button>
      </form>

      <div role="status">{notice ? 'Message sent' : ''}</div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message, index) => (
            <tr key={messages.length - index}>
              <td>{message.name}</td>
              <td>{message.message}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {blocker.state === 'blocked' && (
        <div role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <p id="leave-title">Discard the unfinished message?</p>
          <button type="button" onClick={() => blocker.reset()}>
            Keep editing
          </button>
          <button type="button" onClick={() => blocker.proceed()}>
            Discard
          </button>
        </div>
      )}
    </main>
  );
}

type FieldProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

function Field({ label, error, children }: { label: string; error?: string; children: (props: FieldProps) => ReactNode }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error ? errorId : undefined })}
      {error && <span id={errorId}>{error}</span>}
    </div>
  );
}
