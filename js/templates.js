/**
 * Kita Event Templates Configuration
 */

const KITA_TEMPLATES = [
  {
    name: 'Teamsitzung',
    title: 'Teamsitzung',
    category: 'team',
    duration: '60', // minutes
    isAllDay: false,
    startTime: '14:00',
    description: 'Wöchentliche Teambesprechung.'
  },
  {
    name: 'Elternabend',
    title: 'Elternabend',
    category: 'eltern',
    duration: '120', // minutes
    isAllDay: false,
    startTime: '19:30',
    description: 'Gruppen-Elternabend. Bitte Vorbereitung beachten.'
  },
  {
    name: 'Entwicklungsgespräch',
    title: 'Entwicklungsgespräch',
    category: 'eltern',
    duration: '30', // minutes
    isAllDay: false,
    startTime: '09:00',
    description: 'Elterngespräch zum Entwicklungsstand des Kindes.'
  },
  {
    name: 'Waldtag',
    title: 'Waldtag',
    category: 'ausflug',
    isAllDay: true,
    description: 'Ausflug in den Wald. Bitte wetterfeste Kleidung und Rucksack mitgeben!'
  },
  {
    name: 'Sommerfest',
    title: 'Sommerfest',
    category: 'feier',
    duration: '240',
    isAllDay: false,
    startTime: '14:30',
    description: 'Unser jährliches Kita-Sommerfest für die ganze Familie.'
  },
  {
    name: 'Laternenfest',
    title: 'Laternenfest / St. Martin',
    category: 'feier',
    duration: '120',
    isAllDay: false,
    startTime: '17:00',
    description: 'Sankt Martins Umzug und gemütliches Beisammensein.'
  },
  {
    name: 'Schließtag',
    title: 'Schließtag',
    category: 'schliessung',
    isAllDay: true,
    description: 'Die Einrichtung bleibt heute geschlossen.'
  },
  {
    name: 'Konzeptionstag',
    title: 'Konzeptionstag (Schließung)',
    category: 'schliessung',
    isAllDay: true,
    description: 'Teamtag zur Konzeptionsarbeit. Die Kita bleibt geschlossen.'
  },
  {
    name: 'Urlaub (Mitarbeiter)',
    title: 'Urlaub [Name]',
    category: 'urlaub',
    isAllDay: true,
    description: 'Abwesenheit wegen Urlaub.'
  },
  {
    name: 'Fortbildung',
    title: 'Fortbildung [Name]',
    category: 'urlaub',
    isAllDay: true,
    description: 'Fortbildung für Teammitglieder.'
  },
  {
    name: 'Krankmeldung',
    title: 'Krankmeldung [Name]',
    category: 'urlaub',
    isAllDay: true,
    description: 'Abwesenheit wegen Krankheit.'
  }
];

function renderTemplates(containerId, onSelectCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  KITA_TEMPLATES.forEach(template => {
    const tag = document.createElement('span');
    tag.className = 'template-tag';
    
    let label = '';
    if (template.category === 'team') label = '🔵 ';
    else if (template.category === 'eltern') label = '🟢 ';
    else if (template.category === 'ausflug') label = '🟡 ';
    else if (template.category === 'feier') label = '🟣 ';
    else if (template.category === 'schliessung') label = '🟠 ';
    else if (template.category === 'urlaub') label = '🌸 ';
    
    tag.textContent = `${label}${template.name}`;
    tag.addEventListener('click', () => {
      onSelectCallback(template);
    });
    container.appendChild(tag);
  });
}
