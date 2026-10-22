-- ============================================================================
-- 20_seed.sql  ·  réplica de MethaDesk (desarrollo)  ·  DATOS SINTÉTICOS
-- ----------------------------------------------------------------------------
-- Todo es inventado: personas «Demo …», correos @methacity.test, proyectos DEV-00x.
-- Los nombres de los proyectos de ejemplo los eligió el equipo de Methabau; las cifras
-- (Teilsysteme, montajes, pesos) son inventadas. Las fechas son relativas a hoy, así que
-- siempre hay trabajo atrasado, próximo y futuro. Re-ejecutable (ids deterministas).
-- Ejecutar como md_owner en la base `methadesk`, después de 10_schema.sql.
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ── Departamentos (ABTEILUNGEN_CONFIG) ──────────────────────────────────────
CREATE TEMP TABLE _abt (id text, name text, ord int) ON COMMIT DROP;
INSERT INTO _abt VALUES
  ('projektleiter','Projektleiter',1), ('bauleiter','Bauleitung',2), ('planer','Planer',3),
  ('einkauf','Einkauf',4), ('avor','AVOR',5), ('schlosserei','Schlosserei',6),
  ('blech','Blechabteilung',7), ('werkhof','Werkhof',8), ('montage','Montage',9),
  ('bau','Bau',10), ('subunternehmer','Subunternehmer',11), ('unternehmer','Unternehmer',12);

INSERT INTO public.abteilungen (id, name, "leiterName")
SELECT id, name, 'Demo ' || name FROM _abt
ON CONFLICT (id) DO NOTHING;

-- ── Usuarios (uno por departamento + un superadmin) ─────────────────────────
INSERT INTO public.users (id, username, email, email_normalized, name, vorname, nachname, role, app_role,
                          role_new, department, department_key, rolle, aktiv, stundensatz)
SELECT md5('user-' || a.id)::uuid, 'demo_' || a.id,
       'demo.' || a.id || '@methacity.test', 'demo.' || a.id || '@methacity.test',
       'Demo ' || a.name, 'Demo', a.name, 'user',
       CASE WHEN a.id = 'projektleiter' THEN 'admin' ELSE 'user' END,
       CASE WHEN a.id = 'projektleiter' THEN 'admin' ELSE 'user' END,
       a.name, a.id, 'Demo ' || a.name, true, 70 + a.ord * 3
FROM _abt a
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, username, email, email_normalized, name, vorname, nachname, role, app_role,
                          role_new, department, department_key, rolle, aktiv)
VALUES (md5('user-superadmin')::uuid, 'demo_superadmin', 'demo.superadmin@methacity.test',
        'demo.superadmin@methacity.test', 'Demo Superadmin', 'Demo', 'Superadmin', 'superadmin',
        'superadmin', 'superadmin', 'Projektleiter', 'projektleiter', 'Demo Superadmin', true)
ON CONFLICT (id) DO NOTHING;

-- ── Permisos por departamento ───────────────────────────────────────────────
INSERT INTO public.abt_page_permissions (abteilung_id, page_key)
SELECT a.id, p.k FROM _abt a, (VALUES ('teilsysteme'), ('produktion'), ('lager')) AS p(k)
ON CONFLICT DO NOTHING;
INSERT INTO public.abt_table_permissions (abteilung_id, table_id, can_read, can_export)
SELECT a.id, t.k, true, a.id IN ('projektleiter','bauleiter')
FROM _abt a, (VALUES ('teilsysteme'), ('positionen'), ('unterpositionen')) AS t(k)
ON CONFLICT DO NOTHING;

-- ── Proyectos: 3 activos y 1 archivado ──────────────────────────────────────
INSERT INTO public.projekte (id, projektname, projektnummer, ort, kanton, status, archived,
                             projektleiter, bauleiter, polier, "bimKonstrukteur",
                             "projektleiterIds", "bauleiterIds", "polierIds", "bimKonstrukteurIds")
SELECT md5('proj-' || p.n)::uuid, p.name, 'DEV-00' || p.n, p.ort, p.kt, 'aktiv', p.arch,
       'Demo Projektleiter', 'Demo Bauleitung', 'Demo Bau', 'Demo Planer',
       md5('user-projektleiter')::uuid::text, md5('user-bauleiter')::uuid::text,
       md5('user-bau')::uuid::text, md5('user-planer')::uuid::text
FROM (VALUES (1,'GAZ Ausbildungszentrum, Beringen','Beringen','SH',false), (2,'Innloc AG, Rothenburg','Rothenburg','LU',false),
             (3,'BB20, Wädenswil','Wädenswil','ZH',false), (4,'Altbau Demo (archiviert)','Luzern','LU',true))
     AS p(n, name, ort, kt, arch)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_projekt_zuweisungen (user_id, projekt_id)
SELECT u.id, p.id FROM public.users u CROSS JOIN public.projekte p
WHERE u.email LIKE '%@methacity.test' AND u.department_key IN ('projektleiter','bauleiter','planer','einkauf','avor')
ON CONFLICT DO NOTHING;

-- ── Teilsysteme: 16 por proyecto activo, 4 en el archivado ──────────────────
INSERT INTO public.teilsysteme (id, "projektId", name, "teilsystemNummer", ks, status, "planStatus", abteilung,
    "herkunftsAbteilung", verantwortlich, fertigung, teileart, gewicht, montagetermin, "abgabePlaner",
    lieferdatum, "lieferdatumQuelle", "abrufStatus", "abrufLiefertermin", "produktionsdauerTage",
    "produktionEndeSoll", "terminQuelle", "bauleitungErledigt", "lagerStatus", "eroeffnetAm",
    nachbearbeitung_grund, nachbearbeitung_datum)
SELECT md5('ts-' || p.n || '-' || g)::uuid,
       md5('proj-' || p.n)::uuid,
       (ARRAY['Treppe','Geländer','Vordach','Stütze','Balkon','Fassade','Rampe','Podest','Tor','Fenster'])[1 + g % 10] || ' ' || g,
       'TS-' || p.n || '-' || lpad(g::text, 3, '0'),
       'KS' || (1 + g % 4),
       st.s,
       CASE WHEN st.s IN ('in_planung','offen') THEN 'offen' ELSE 'fertig' END,
       (ARRAY['AVOR','Schlosserei','Blechabteilung','Einkauf','Werkhof','Montage','Planer','Bauleitung','Bau','Projektleiter','Subunternehmer','Unternehmer'])[1 + (g * 5 + p.n) % 12],
       'Planer',
       'Demo ' || (ARRAY['Planer','Bauleitung','AVOR'])[1 + g % 3],
       CASE WHEN g % 3 = 0 THEN 'extern' ELSE 'intern' END,
       (ARRAY['Stahl','Blech','Beschlag'])[1 + g % 3],
       50 + (g * 37 + p.n * 11) % 900,
       to_char(current_date + ((g * 9 + p.n * 5) % 70) - 20, 'YYYY-MM-DD'),
       to_char(current_date + ((g * 9 + p.n * 5) % 70) - 50, 'YYYY-MM-DD'),
       to_char(current_date + ((g * 9 + p.n * 5) % 70) - 27, 'YYYY-MM-DD'),
       'manuell',
       CASE WHEN g % 8 = 0 AND st.s IN ('bestellt','fertig','in_arbeit','offen','teilgeliefert') THEN 'abgerufen' END,
       CASE WHEN g % 8 = 0 AND st.s IN ('bestellt','fertig','in_arbeit','offen','teilgeliefert')
            THEN to_char(current_date + 5 + g % 10, 'YYYY-MM-DD') END,
       10 + g % 15,
       to_char(current_date + ((g * 9 + p.n * 5) % 70) - 30, 'YYYY-MM-DD'),
       'manuell',
       g % 5 = 0,
       CASE WHEN st.s IN ('geliefert','teilgeliefert') THEN 'eingelagert' END,
       now() - (g || ' days')::interval,
       CASE WHEN st.s = 'nachbearbeitung' THEN 'Demo: Passung prüfen' END,
       CASE WHEN st.s = 'nachbearbeitung' THEN to_char(current_date - g % 7, 'YYYY-MM-DD') END
FROM generate_series(1, 4) AS p(n),
     generate_series(1, 16) AS g,
     LATERAL (SELECT (ARRAY['in_planung','offen','in_arbeit','bestellt','fertig','teilgeliefert','geliefert','verbaut','nachbearbeitung','express'])[1 + (g + p.n) % 10] AS s) AS st
WHERE p.n < 4 OR g <= 4
ON CONFLICT (id) DO NOTHING;

-- ── Posiciones y subposiciones ──────────────────────────────────────────────
INSERT INTO public.positionen (id, "teilsystemId", "projektId", name, nummer, "posNummer", status, "planStatus",
                               abteilung, menge, einheit, material, teileart, profil, weight)
SELECT md5('pos-' || t.id || '-' || q)::uuid, t.id, t."projektId", 'Pos ' || q, q::text, t."teilsystemNummer" || '.' || q,
       t.status, t."planStatus", t.abteilung, 1 + q, 'Stk', 'S235', t.teileart, 'HEA200', 12.5 * q
FROM public.teilsysteme t, generate_series(1, 3) AS q
WHERE right(t."teilsystemNummer", 1)::int % 2 = 0
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.unterpositionen (id, "positionId", "teilsystemId", "projektId", name, nummer, "untPosNummer",
                                    status, "planStatus", abteilung, menge, einheit, gewicht)
SELECT md5('upos-' || p.id || '-' || q)::uuid, p.id, p."teilsystemId", p."projektId", 'UPos ' || q, q::text,
       p."posNummer" || '.' || q, p.status, p."planStatus", p.abteilung, 2, 'Stk', 3.2 * q
FROM public.positionen p, generate_series(1, 2) AS q
WHERE p.nummer = '1'
ON CONFLICT (id) DO NOTHING;

-- ── Grupos y Abrufe ─────────────────────────────────────────────────────────
INSERT INTO public.teilsystem_gruppen (id, "teilsystemId", "projektId", name, abteilung, status, sortierung)
SELECT md5('grp-' || t.id || '-' || k.n)::uuid, t.id::text, t."projektId"::text, k.name, k.abt,
       (ARRAY['offen','in_arbeit','fertig'])[1 + (right(t."teilsystemNummer", 2)::int + k.n) % 3], k.n
FROM public.teilsysteme t,
     (VALUES (1, 'Laserteile', 'Schlosserei'), (2, 'Montagematerial', 'Werkhof')) AS k(n, name, abt)
WHERE right(t."teilsystemNummer", 1)::int % 5 = 0
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.teilsystem_abrufe (id, "teilsystemId", "projektId", status, liefertermin, flags,
                                      "abgerufenAm", "abgerufenVonName")
SELECT md5('abruf-' || t.id)::uuid, t.id::text, t."projektId"::text, 'abgerufen', t."abrufLiefertermin", '{}'::jsonb,
       now() - interval '2 days', 'Demo Bauleitung'
FROM public.teilsysteme t
WHERE t."abrufStatus" = 'abgerufen'
ON CONFLICT (id) DO NOTHING;

-- ── Pedidos de material y material ──────────────────────────────────────────
INSERT INTO public.bestellungen (id, "projektId", status, bestelldatum, "bestelltVon", "containerBez", items, liefertermin)
SELECT md5('best-' || p.n || '-' || k)::uuid, md5('proj-' || p.n)::uuid,
       (ARRAY['angefragt','in_bearbeitung','bereit','versendet','geliefert'])[1 + (k + p.n) % 5],
       to_char(current_date - k, 'YYYY-MM-DD'), 'Demo Bau', 'Container ' || p.n || '-' || k,
       jsonb_build_array(
         jsonb_build_object('id', 'a' || k, 'materialName', 'Schrauben M12', 'menge', 100 * k, 'einheit', 'Stk', 'vorbereitet', k % 2 = 0),
         jsonb_build_object('id', 'b' || k, 'materialName', 'Ankerplatte', 'menge', 4 * k, 'einheit', 'Stk', 'vorbereitet', false)),
       to_char(current_date + (k * 3) - 6, 'YYYY-MM-DD')
FROM generate_series(1, 3) AS p(n), generate_series(1, 3) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.material (id, "projektId", "teilsystemId", bezeichnung, name, menge, einheit, preis, lieferant, liefertermin, status)
SELECT md5('mat-' || t.id)::uuid, t."projektId", t.id, 'Material ' || t."teilsystemNummer", 'Mat ' || t."teilsystemNummer",
       10, 'Stk', 25.5, 'Demo Lieferant ' || (1 + right(t."teilsystemNummer", 1)::int % 4),
       to_char(current_date + right(t."teilsystemNummer", 2)::int % 20, 'YYYY-MM-DD'), 'offen'
FROM public.teilsysteme t
WHERE right(t."teilsystemNummer", 1)::int % 3 = 0
ON CONFLICT (id) DO NOTHING;

-- ── Lager: un lagerort por proyecto, 3 lagerplätze, paquetes y movimientos ──
INSERT INTO public.lagerorte (id, "projektId", name, bezeichnung, typ, bereich)
SELECT md5('lo-' || p.id)::uuid, p.id, 'Lager ' || p.projektnummer, 'Lager ' || p.projektnummer, 'Baustelle', 'Baustelle'
FROM public.projekte p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lagerplaetze (id, "lagerortId", "projektId", bezeichnung, bereich)
SELECT md5('lp-' || l.id || '-' || k)::uuid, l.id, l."projektId", 'Platz ' || k, 'Baustelle'
FROM public.lagerorte l, generate_series(1, 3) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pakete (id, "lagerplatzId", "projektId", bezeichnung, typ, status, "teilsystemId")
SELECT md5('pk-' || lp.id)::uuid, lp.id, lp."projektId", 'Paket ' || lp.bezeichnung, 'Palette',
       (ARRAY['eingelagert','bereit','ausgelagert'])[1 + right(lp.bezeichnung, 1)::int % 3], NULL
FROM public.lagerplaetze lp
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lagerbewegungen (id, "lagerortId", "projektId", typ, menge, einheit, datum, created_at)
SELECT md5('lb-' || lp.id || '-' || k)::uuid, lp."lagerortId", lp."projektId",
       (ARRAY['einlagern','auslagern','umlagern'])[1 + k % 3], k, 'Stk',
       to_char(current_date - k, 'YYYY-MM-DD'), now() - (k || ' days')::interval
FROM public.lagerplaetze lp, generate_series(1, 4) AS k
ON CONFLICT (id) DO NOTHING;

-- ── Ejecución en obra y equipos ─────────────────────────────────────────────
INSERT INTO public.teams (id, name, "projektId", abteilung, color)
SELECT md5('team-' || p.n || '-' || k)::uuid, 'Team ' || k, md5('proj-' || p.n)::uuid, 'Montage', '#ff6b35'
FROM generate_series(1, 3) AS p(n), generate_series(1, 2) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ausfuehrung_tasks (id, "projektId", "teilsystemId", title, status, priority, "dueDate",
                                      "scheduledDate", "estimatedHours", "planStatus")
SELECT md5('task-' || t.id)::uuid, t."projektId", t.id, 'Montage ' || t."teilsystemNummer",
       (ARRAY['Offen','In Arbeit','Erledigt'])[1 + right(t."teilsystemNummer", 2)::int % 3], 'Normal',
       to_char(current_date + right(t."teilsystemNummer", 2)::int % 14 - 3, 'YYYY-MM-DD'),
       to_char(current_date + right(t."teilsystemNummer", 2)::int % 14 - 5, 'YYYY-MM-DD'),
       4 + right(t."teilsystemNummer", 1)::int, 'Geplant'
FROM public.teilsysteme t
WHERE right(t."teilsystemNummer", 1)::int % 6 = 0
ON CONFLICT (id) DO NOTHING;

-- ── Flota, máquinas, proveedores ────────────────────────────────────────────
INSERT INTO public.fahrzeuge (id, bezeichnung, typ, kategorie, status, standort, inventarnummer, baujahr, "geprueftBis", abgaswartung)
SELECT md5('fz-' || k)::uuid, 'Fahrzeug ' || k, (ARRAY['Transporter','Kran','Stapler'])[1 + k % 3], 'Fuhrpark',
       (ARRAY['Verfuegbar','Im Einsatz','Wartung'])[1 + k % 3], 'Werkhof', 'INV-' || k, 2015 + k,
       to_char(current_date + k * 20 - 40, 'YYYY-MM-DD'), to_char(current_date + k * 30 - 60, 'YYYY-MM-DD')
FROM generate_series(1, 6) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fahrzeug_reservierungen (id, "fahrzeugId", "projektId", "startDatum", "endDatum", zweck, status)
SELECT md5('fr-' || k)::uuid, md5('fz-' || k)::uuid, md5('proj-' || (1 + k % 3))::uuid,
       to_char(current_date + k, 'YYYY-MM-DD'), to_char(current_date + k + 3, 'YYYY-MM-DD'), 'Montage', 'aktiv'
FROM generate_series(1, 4) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.maschinen (id, name, category, antrieb)
SELECT md5('ma-' || k)::uuid, 'Demo-Maschine ' || k, (ARRAY['Hebebühne','Bagger','Kran'])[1 + k % 3], 'Diesel'
FROM generate_series(1, 5) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.maschinen_anfragen (id, maschine_id, projekt_id, angefragt_von, einsatzort, zeitraum_von,
                                       zeitraum_bis, status, prioritaet, projekt_name)
SELECT md5('mar-' || k)::uuid, md5('ma-' || k)::uuid, md5('proj-' || (1 + k % 3))::uuid, 'Demo Bauleitung',
       'Baustelle ' || k, current_date + k * 2, current_date + k * 2 + 4, 'offen', 'normal', 'Demo'
FROM generate_series(1, 3) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lieferanten (id, name, kategorie, aktiv, archiviert)
SELECT md5('lief-' || k)::uuid, 'Demo Lieferant ' || k, (ARRAY['Unternehmer','Bauherr','Mieter'])[1 + k % 3], true, false
FROM generate_series(1, 8) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.subunternehmer (id, name, fachgebiet, aktiv, archiviert)
SELECT md5('sub-' || k)::uuid, 'Demo Subunternehmer ' || k, (ARRAY['Schweissen','Beschichten','Montage'])[1 + k % 3], true, false
FROM generate_series(1, 4) AS k
ON CONFLICT (id) DO NOTHING;

-- ── Auditoría: ~400 cambios en 60 días ──────────────────────────────────────
INSERT INTO public.changelog (id, "entityId", "entityType", "projektId", field, action, "changedAt", "changedBy",
                              "oldValue", "newValue")
SELECT md5('cl-' || i)::uuid, t.id, 'teilsystem', t."projektId",
       (ARRAY['status','planStatus','montagetermin','abteilung','lieferdatum'])[1 + i % 5],
       (ARRAY['update','update','create'])[1 + i % 3],
       now() - ((i % 60) || ' days')::interval - ((i % 24) || ' hours')::interval,
       'Demo ' || (ARRAY['Planer','Bauleitung','AVOR'])[1 + i % 3], 'alt', 'neu'
FROM generate_series(1, 400) AS i
JOIN LATERAL (SELECT id, "projektId" FROM public.teilsysteme ORDER BY id OFFSET (i % 60) LIMIT 1) AS t ON true
ON CONFLICT (id) DO NOTHING;

-- ── Datos económicos (solo los lee el esquema opcional mc_finanz) ────────────
INSERT INTO public.kosten (id, "projektId", bezeichnung, betrag, kategorie, datum)
SELECT md5('ko-' || p.n || '-' || k)::uuid, md5('proj-' || p.n)::uuid, 'Kosten ' || k, 1000 * k, 'Material',
       to_char(current_date - k * 5, 'YYYY-MM-DD')
FROM generate_series(1, 3) AS p(n), generate_series(1, 4) AS k
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ts_stunden (id, "teilsystemId", "projektId", "mitarbeiterId", "mitarbeiterName", datum, stunden,
                               stundensatz, gesamtpreis, abteilung, taetigkeit)
SELECT 'sd-' || t.id, t.id, t."projektId", md5('user-schlosserei')::uuid, 'Demo Schlosserei',
       current_date - right(t."teilsystemNummer", 2)::int % 40, 8, 80, 640, 'Schlosserei', 'Fertigung'
FROM public.teilsysteme t
WHERE right(t."teilsystemNummer", 1)::int % 4 = 0
ON CONFLICT (id) DO NOTHING;

COMMIT;
