/**
 * Textkatalog der Oberfläche. MethaCity ist wie MethaDesk nur auf Deutsch (Schweizer
 * Schreibweise: «ss» statt «ß»). Fachliche Prüfung der Übersetzungen ausstehend.
 */
export const de = {
  app: {
    title: 'METHACity',
    description: 'Agenten-Leitstand von METHABAU, verbunden mit MethaDesk.',
  },
  header: {
    brandSub: 'CONNECTED CAMPUS',
    edition: 'METHACITY',
    editionNumber: '/ 02',
    editionSub: 'GESAMTÜBERSICHT',
    viewsLabel: 'Ansichten',
    tabCity: '3D-Stadt',
    tabHierarchy: 'Hierarchie',
    concept: 'INTERAKTIVES KONZEPT',
  },
  scene: {
    label: 'Interaktive 3D-Stadt von Methabau',
    eyebrow: 'ÖKOSYSTEM METHABAU',
    titleLine1: 'Eine Stadt.',
    titleLine2: 'Alles verbunden.',
    subtitle: 'Produktion und Baustelle.',
    subtitleStrong: 'Eine gemeinsame Sicht.',
    indexLabel: 'BEZIRKE / EINHEITEN',
    canvasLabel: 'Mit den Pfeiltasten oder durch Ziehen drehen, mit + und − zoomen. Gebäude im Panel oder per Klick auswählen.',
    loading: 'Die Stadt wird gebaut …',
    noWebgl: 'Die 3D-Ansicht benötigt WebGL. Bitte Chrome oder Edge verwenden. Die Struktur bleibt im Panel verfügbar.',
    contextLost: 'Die 3D-Ansicht wurde angehalten. Bitte die Seite neu laden. Die Struktur bleibt im Panel verfügbar.',
  },
  camera: {
    label: 'Kamerasteuerung',
    zoomIn: 'Vergrössern',
    zoomOut: 'Verkleinern',
    reset: 'Ansicht zurücksetzen',
    topView: 'Luftansicht',
  },
  toolbar: {
    label: 'Darstellungsoptionen',
    orbit: 'Orbit',
    links: 'Verbindungen',
    sunset: 'Abendlicht',
    daylight: 'Tageslicht',
  },
  legend: {
    hierarchy: 'HIERARCHISCHE ABHÄNGIGKEIT',
    coordination: 'KOORDINATION ZWISCHEN BEZIRKEN',
    drag: 'ZIEHEN ZUM DREHEN',
    wheel: 'MAUSRAD ZUM ZOOMEN',
    compass: 'Referenzausrichtung des Modells',
  },
  districts: {
    industrial: 'Industriebezirk',
    project: 'Projektbezirk',
  },
  panel: {
    top: 'STRUKTUR DER STADT',
    open: 'offen',
    overdue: 'Montage überfällig',
    rework: 'Nachbearbeitung',
    noData: 'keine Daten',
    external: 'extern',
    focus: 'Dieses Gebäude aus der Nähe ansehen',
    note: 'Vorläufiges Panel: Beschriftungen, Hierarchie-Ansicht und das vollständige Panel folgen in Phase F3.',
  },
  data: {
    mock: 'SIMULIERTE DATEN',
    live: 'DATEN AUS METHADESK',
    scenario: 'Szenario {name}',
    asOf: 'Datenstand {time}',
    error: 'Die Daten konnten nicht geladen werden. Bitte in einigen Minuten erneut versuchen.',
    empty: 'Noch keine Daten aus MethaDesk vorhanden.',
  },
  units: {
    avor: {
      role: 'ORCHESTRIERENDER KERN',
      description: 'Das Koordinationszentrum des Industriebezirks. Es organisiert die Arbeitsvorbereitung und verbindet Einkauf, Schlosserei, Blechabteilung und Werkhof mit den Anforderungen der Baustelle.',
    },
    einkauf: {
      role: 'BESCHAFFUNG',
      description: 'Einkauf, Lieferanten und Beschaffung. Das Gebäude gehört zum Bezirk, den Produktion / AVOR koordiniert.',
    },
    schlosserei: {
      role: 'METALLBAU',
      description: 'Fertigung und Schlosserarbeiten. Eine Industriehalle, direkt mit Produktion / AVOR verbunden.',
    },
    blech: {
      role: 'BLECHVERARBEITUNG',
      description: 'Die Blechabteilung mit eigener Halle und Sheddach. Untersteht Produktion / AVOR.',
    },
    werkhof: {
      role: 'LOGISTIK UND MATERIAL',
      description: 'Material, Lager und logistische Unterstützung. Der Lade- und Versandhof gehört zum Bezirk von Produktion / AVOR.',
    },
    projektleitung: {
      role: 'PROJEKTLEITUNG',
      description: 'Die Spitze des Projektbezirks. Verantwortlich für die Bauleitung, die ihrerseits die Ausführung auf dem Bau leitet.',
    },
    bauleitung: {
      role: 'BAULEITUNG',
      description: 'Leitet die Baustelle unter der Projektleitung und koordiniert den Bau. Eine Querverbindung führt zu Produktion / AVOR für die Abstimmung zwischen Baustelle und Produktion.',
    },
    bau: {
      role: 'AUSFÜHRUNG AUF DER BAUSTELLE',
      description: 'Die Ausführung vor Ort. Untersteht der Bauleitung und ist als aktive Baustelle mit Rohbau, Kran und Containern dargestellt.',
    },
  },
} as const;
