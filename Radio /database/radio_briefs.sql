create table if not exists radio_briefs (
  id              bigserial primary key,
  order_id        text,
  kund            text not null,
  kontaktperson   text,
  telefon         text,
  epost           text,
  saljare         text,
  kampanjperiod   text,
  format          text,
  antal_spottar   text,

  syfte           text,
  malgrupp        text,
  budskap         text,
  cta             text,
  ton             text,
  ovriga_tankar   text,
  praktiskt       text,
  period_detaljer text,
  ovrigt          text,
  tankapa         text,

  status          text not null default 'ny'
                  check (status in ('ny', 'manus', 'inspelning', 'levererad')),
  deadline        date,
  skapad          timestamptz not null default now(),
  uppdaterad      timestamptz not null default now()
);

create index if not exists radio_briefs_status_deadline_idx
  on radio_briefs (status, deadline);

create index if not exists radio_briefs_created_idx
  on radio_briefs (skapad desc);
