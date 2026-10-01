'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconReport } from '@/components/icons';
import { Field, Input, PageTitle, Panel, Segmented, Select } from '@/components/ui';
import { useI18n, type Locale, type MessageKey } from '@/i18n';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function Card({ title, help, links }: { title: string; help: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-ink-600 bg-ink-900 p-4">
      <div className="flex gap-3">
        <span className="mt-0.5 text-accent">
          <IconReport />
        </span>
        <div>
          <div className="font-medium text-slate-100">{title}</div>
          <p className="mt-1 text-xs text-slate-400">{help}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className="rounded border border-ink-500 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-accent hover:text-accent"
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 7 * 864e5)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [robotId, setRobotId] = useState('');
  const [lang, setLang] = useState<Locale>(locale);
  const robots = useAsync(() => api.robots.list(), []);
  const range = { from: new Date(`${from}T00:00:00`), to: new Date(`${to}T23:59:59`) };
  const robot = robotId || undefined;
  const cards: { title: MessageKey; help: MessageKey; links: { label: string; href: string }[] }[] = [
    {
      title: 'reports.summary',
      help: 'reports.summaryHelp',
      links: [
        { label: 'PDF', href: api.reports.summary(range, 'pdf', lang, robot) },
        { label: 'Excel', href: api.reports.summary(range, 'xlsx', lang, robot) },
      ],
    },
    {
      title: 'reports.anomalies',
      help: 'reports.anomaliesHelp',
      links: [{ label: 'Excel', href: api.reports.anomalies(range, lang, robot) }],
    },
    { title: 'reports.patrols', help: 'reports.patrolsHelp', links: [{ label: 'Excel', href: api.reports.patrols(range, lang, robot) }] },
  ];
  return (
    <>
      <PageTitle title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('reports.period')}>
            <div className="flex items-center gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-slate-500">—</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </Field>
          <Field label={t('common.robot')}>
            <Select value={robotId} onChange={(e) => setRobotId(e.target.value)} className="w-44">
              <option value="">{t('common.allRobots')}</option>
              {robots.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('reports.language')}>
            <Segmented<Locale>
              value={lang}
              onChange={setLang}
              options={[
                { value: 'en', label: 'English' },
                { value: 'id', label: 'Indonesia' },
              ]}
            />
          </Field>
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} title={t(c.title)} help={t(c.help)} links={c.links} />
        ))}
        <div className="flex flex-col justify-between rounded-lg border border-dashed border-ink-500 p-4">
          <div>
            <div className="font-medium text-slate-100">{t('reports.patrolReports')}</div>
            <p className="mt-1 text-xs text-slate-400">{t('reports.patrolReportsHelp')}</p>
          </div>
          <Link href="/patrols" className="mt-4 text-sm text-accent">
            {t('nav.patrols')} →
          </Link>
        </div>
      </div>
    </>
  );
}
