import { useState } from 'react';
import { Building2, Loader2, Mail, Phone, Plus, Search, X } from 'lucide-react';
import { useClients, useCreateClient } from '../lib/queries.js';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [isCreating, setCreating] = useState(false);
  const { data: clients, isLoading } = useClients(search || undefined);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink">Clientes</h1>
          <p className="mt-2 text-sm text-ink-soft">{clients?.length ?? 0} registrados</p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow"
        >
          <Plus size={15} />
          Nuevo cliente
        </button>
      </header>

      <div className="relative mt-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, empresa o correo"
          className="w-full rounded-lg border border-line bg-surface-1 py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink-mute focus:border-jade focus:outline-none"
        />
      </div>

      {isCreating && <NewClientForm onClose={() => setCreating(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={20} className="animate-spin text-jade" />
        </div>
      ) : clients?.length === 0 ? (
        <p className="panel mt-6 py-16 text-center text-sm text-ink-mute">
          {search ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes.'}
        </p>
      ) : (
        <div className="panel mt-6 divide-y divide-line overflow-hidden">
          {clients?.map((client) => (
            <article key={client.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-sm font-semibold text-jade">
                {client.name.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{client.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.7rem] text-ink-mute">
                  {client.company && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={11} />
                      {client.company}
                    </span>
                  )}
                  {client.email && (
                    <span className="metric flex items-center gap-1.5">
                      <Mail size={11} />
                      {client.email}
                    </span>
                  )}
                  {client.phone && (
                    <span className="metric flex items-center gap-1.5">
                      <Phone size={11} />
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>

              {client.tags.length > 0 && (
                <div className="flex shrink-0 gap-1.5">
                  {client.tags.map((tag) => (
                    <span
                      key={tag}
                      className="metric rounded-full border border-line px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-ink-mute"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NewClientForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const createClient = useCreateClient();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        createClient.mutate(
          { name, company: company || null, email: email || null },
          { onSuccess: onClose },
        );
      }}
      className="panel reveal mt-6 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="metric text-xs uppercase tracking-wider text-ink-soft">Nuevo cliente</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1 text-ink-mute hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          required
          minLength={2}
          className={inputClass}
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Empresa"
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo"
          className={inputClass}
        />
        <button
          type="submit"
          disabled={createClient.isPending || name.trim().length < 2}
          className="flex items-center justify-center rounded-lg bg-jade px-4 py-2.5 text-sm font-semibold text-surface-0 transition-colors hover:bg-jade-glow disabled:opacity-40"
        >
          {createClient.isPending ? <Loader2 size={15} className="animate-spin" /> : 'Crear'}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  'rounded-lg border border-line bg-surface-0 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-mute focus:border-jade focus:outline-none';
