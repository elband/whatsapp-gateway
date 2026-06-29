import { useMemo, useState } from 'react'
import { Copy, Check, ExternalLink, KeyRound, Server, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import { API_URL, API_BASE } from '../lib/api'

// Warna lencana per-method HTTP.
const METHOD_COLORS = {
  GET: 'bg-sky-100 text-sky-700',
  POST: 'bg-emerald-100 text-emerald-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Gagal menyalin')
    }
  }
  return (
    <div className="group relative">
      <button
        onClick={copy}
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md bg-slate-700/80 px-2 py-1 text-xs text-slate-200 opacity-0 transition hover:bg-slate-600 group-hover:opacity-100"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'Disalin' : 'Salin'}
      </button>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-100">
        <code className={`language-${lang}`}>{code}</code>
      </pre>
    </div>
  )
}

function MethodBadge({ method }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${METHOD_COLORS[method] || 'bg-slate-100 text-slate-700'}`}>
      {method}
    </span>
  )
}

function Endpoint({ id, method, path, scope, title, desc, body, response, curl }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={method} />
        <code className="rounded bg-slate-100 px-2 py-1 text-sm font-medium text-slate-800">{path}</code>
        {scope && (
          <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
            scope: <span className="font-semibold text-slate-700">{scope}</span>
          </span>
        )}
      </div>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}

      {body && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Request body</p>
          <CodeBlock code={body} lang="json" />
        </div>
      )}

      {curl && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Contoh (cURL)</p>
          <CodeBlock code={curl} lang="bash" />
        </div>
      )}

      {response && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Respons</p>
          <CodeBlock code={response} lang="json" />
        </div>
      )}
    </section>
  )
}

export default function ApiDocs() {
  const base = API_BASE
  const docsUrl = `${API_URL}/api/docs`

  const endpoints = useMemo(
    () => [
      {
        id: 'send-text',
        method: 'POST',
        path: '/messages/send',
        scope: 'message.send',
        title: 'Kirim pesan teks',
        desc: 'Memasukkan pesan ke antrean lalu dikirim oleh worker. Nomor diverifikasi ke WhatsApp dulu.',
        body: `{
  "deviceId": 1,
  "to": "08123456789",
  "body": "Halo dari WhatsApp Gateway"
}`,
        curl: `curl -X POST "${base}/messages/send" \\
  -H "X-API-Key: wag_xxx.yyy" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"08123456789","body":"Halo dari WhatsApp Gateway"}'`,
        response: `{
  "success": true,
  "message": "Pesan dimasukkan ke antrean",
  "data": { "id": 123, "status": "QUEUED", "to": "628123456789" }
}`,
      },
      {
        id: 'send-media',
        method: 'POST',
        path: '/messages/send-media',
        scope: 'message.send',
        title: 'Kirim media (gambar/video/audio/dokumen)',
        desc: 'Gunakan multipart/form-data. Field: file (binary), to, type, caption, deviceId.',
        curl: `curl -X POST "${base}/messages/send-media" \\
  -H "X-API-Key: wag_xxx.yyy" \\
  -F "file=@/path/gambar.jpg" \\
  -F "to=08123456789" \\
  -F "type=IMAGE" \\
  -F "caption=Lihat ini"`,
        response: `{ "success": true, "message": "Media dimasukkan ke antrean", "data": { "id": 124 } }`,
      },
      {
        id: 'send-location',
        method: 'POST',
        path: '/messages/send-location',
        scope: 'message.send',
        title: 'Kirim lokasi',
        body: `{
  "to": "08123456789",
  "latitude": -6.1751,
  "longitude": 106.8650,
  "name": "Monas",
  "address": "Jakarta Pusat"
}`,
      },
      {
        id: 'send-contact',
        method: 'POST',
        path: '/messages/send-contact',
        scope: 'message.send',
        title: 'Kirim kontak (vCard)',
        body: `{
  "to": "08123456789",
  "contactName": "Budi",
  "contactPhone": "08987654321"
}`,
      },
      {
        id: 'send-buttons',
        method: 'POST',
        path: '/messages/send-buttons',
        scope: 'message.send',
        title: 'Kirim pesan tombol',
        desc: 'Maks. 3 tombol. Dukungan tergantung versi/akun WhatsApp.',
        body: `{
  "to": "08123456789",
  "body": "Pilih menu:",
  "footer": "Layanan kami",
  "buttons": [
    { "id": "info", "text": "Info" },
    { "id": "order", "text": "Pesan" }
  ]
}`,
      },
      {
        id: 'send-list',
        method: 'POST',
        path: '/messages/send-list',
        scope: 'message.send',
        title: 'Kirim pesan list',
        body: `{
  "to": "08123456789",
  "body": "Silakan pilih layanan",
  "buttonText": "Lihat menu",
  "sections": [
    {
      "title": "Penerbangan",
      "rows": [
        { "id": "arr", "title": "Kedatangan", "description": "Jadwal tiba" },
        { "id": "dep", "title": "Keberangkatan" }
      ]
    }
  ]
}`,
      },
      {
        id: 'check',
        method: 'POST',
        path: '/messages/check',
        scope: 'message.read',
        title: 'Cek nomor terdaftar WhatsApp',
        desc: 'Bisa satu nomor (string) atau banyak (array). Device harus terhubung.',
        body: `{ "numbers": ["08123456789", "08987654321"] }`,
        response: `{
  "success": true,
  "data": [
    { "input": "08123456789", "phone": "628123456789", "exists": true, "jid": "628123456789@s.whatsapp.net" }
  ]
}`,
      },
      {
        id: 'otp-send',
        method: 'POST',
        path: '/otp/send',
        scope: 'message.send',
        title: 'Generate & kirim OTP via WhatsApp',
        body: `{
  "to": "08123456789",
  "length": 6,
  "expiresMinutes": 5,
  "template": "Kode OTP Anda: {{code}}"
}`,
      },
      {
        id: 'otp-verify',
        method: 'POST',
        path: '/otp/verify',
        scope: '—',
        title: 'Verifikasi kode OTP',
        body: `{ "to": "08123456789", "code": "123456" }`,
        response: `{ "success": true, "data": { "valid": true } }`,
      },
      {
        id: 'list-messages',
        method: 'GET',
        path: '/messages',
        scope: '—',
        title: 'Daftar pesan (riwayat)',
        desc: 'Query: page, limit, deviceId, direction, status, type, search, from, to.',
        curl: `curl "${base}/messages?direction=OUTBOUND&status=SENT&limit=20" \\
  -H "X-API-Key: wag_xxx.yyy"`,
      },
      {
        id: 'get-message',
        method: 'GET',
        path: '/messages/:id',
        scope: '—',
        title: 'Detail satu pesan',
      },
      {
        id: 'resend',
        method: 'POST',
        path: '/messages/:id/resend',
        scope: '—',
        title: 'Kirim ulang pesan',
        desc: 'Set status kembali ke QUEUED dan masukkan lagi ke antrean.',
      },
    ],
    [base],
  )

  return (
    <div>
      <PageHeader
        title="API Documentation"
        subtitle="Referensi REST API untuk integrasi aplikasi eksternal (ERP, Helpdesk, OTP, dll)."
        actions={
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <ExternalLink size={16} /> Swagger Interaktif
          </a>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Navigasi anchor */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 space-y-1">
            <a href="#getting-started" className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Memulai
            </a>
            <a href="#auth" className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Autentikasi
            </a>
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Endpoint</p>
            {endpoints.map((e) => (
              <a
                key={e.id}
                href={`#${e.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                {e.title}
              </a>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {/* Memulai */}
          <section id="getting-started" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Server size={18} className="text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900">Memulai</h2>
            </div>
            <p className="text-sm text-slate-600">
              Semua endpoint berada di bawah base URL berikut. Format respons selalu konsisten:
              <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{'{ success, message, data }'}</code>.
            </p>
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Base URL</p>
              <CodeBlock code={base} lang="text" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green">REST / JSON</Badge>
              <Badge tone="gray">OpenAPI 3.0</Badge>
              <Badge tone="gray">Rate limited</Badge>
            </div>
          </section>

          {/* Autentikasi */}
          <section id="auth" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900">Autentikasi</h2>
            </div>
            <p className="text-sm text-slate-600">
              Dua cara: <strong>API Key</strong> (disarankan untuk integrasi aplikasi) atau <strong>Bearer JWT</strong>{' '}
              (dipakai dashboard). Buat API Key di menu{' '}
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <KeyRound size={13} /> API Keys
              </span>
              .
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">API Key (header)</p>
                <CodeBlock code={`X-API-Key: wag_<prefix>.<secret>`} lang="text" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">JWT (header)</p>
                <CodeBlock code={`Authorization: Bearer <access_token>`} lang="text" />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Scope &amp; device:</strong> API Key dibatasi oleh <em>scope</em> (mis. <code>message.send</code>) dan
              hanya boleh memakai device default-nya. Jika key tidak punya device default, sertakan <code>deviceId</code> di
              setiap request.
            </div>
          </section>

          {/* Daftar endpoint */}
          {endpoints.map((e) => (
            <Endpoint key={e.id} {...e} />
          ))}

          {/* Catatan error */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Format error</h2>
            <p className="mt-1 text-sm text-slate-600">
              Galat dikembalikan dengan status HTTP yang sesuai (400/401/403/404/429/500) dan body:
            </p>
            <div className="mt-3">
              <CodeBlock
                code={`{
  "success": false,
  "message": "API Key tidak memiliki scope: message.send"
}`}
                lang="json"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
