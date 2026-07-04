/**
 * German Natural Language Parser for Kita Calendar Events
 * 100% Client-Side, 100% Free
 * Optimized for German Speech Recognition outputs
 */

// Helper to format local Date object to YYYY-MM-DD without timezone shifts
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseGermanEventText(rawText, referenceDate = new Date()) {
  let text = rawText.trim();
  const result = {
    title: 'Neuer Termin',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    category: 'team',
    originalText: rawText
  };

  // 1. Determine Category based on keywords
  const lowerText = text.toLowerCase();
  if (lowerText.includes('eltern') || lowerText.includes('gespräch') || lowerText.includes('entwicklungs')) {
    result.category = 'eltern';
  } else if (lowerText.includes('ausflug') || lowerText.includes('wald') || lowerText.includes('museum') || lowerText.includes('zoo')) {
    result.category = 'ausflug';
  } else if (lowerText.includes('wichtig') || lowerText.includes('achtung') || lowerText.includes('frist') || lowerText.includes('abgabe')) {
    result.category = 'wichtig';
  } else if (lowerText.includes('fest') || lowerText.includes('feier') || lowerText.includes('party') || lowerText.includes('sommerfest') || lowerText.includes('weihnacht')) {
    result.category = 'feier';
  } else if (lowerText.includes('schließ') || lowerText.includes('schliess') || lowerText.includes('ferien') || lowerText.includes('brückentag') || lowerText.includes('feiertag')) {
    result.category = 'schliessung';
  } else {
    result.category = 'team'; // default
  }

  // 2. Check for "ganztägig" / "ganztags"
  if (lowerText.includes('ganztägig') || lowerText.includes('ganztags') || lowerText.includes('ganzen tag')) {
    result.isAllDay = true;
  }

  // 3. Date Parsing
  let parsedDate = new Date(referenceDate);
  let dateFound = false;

  // Relative Date: heute, morgen, übermorgen (Unicode boundary safe)
  if (/(?:^|[^a-zA-Z0-9äöüÄÖÜß])heute(?:$|[^a-zA-Z0-9äöüÄÖÜß])/i.test(text)) {
    parsedDate = new Date(referenceDate);
    dateFound = true;
  } else if (/(?:^|[^a-zA-Z0-9äöüÄÖÜß])morgen(?:$|[^a-zA-Z0-9äöüÄÖÜß])/i.test(text)) {
    parsedDate.setDate(referenceDate.getDate() + 1);
    dateFound = true;
  } else if (/(?:^|[^a-zA-Z0-9äöüÄÖÜß])übermorgen(?:$|[^a-zA-Z0-9äöüÄÖÜß])/i.test(text)) {
    parsedDate.setDate(referenceDate.getDate() + 2);
    dateFound = true;
  }

  // Relative Weekdays (Montag, Dienstag, etc.)
  const weekdaysGerman = {
    'sonntag': 0, 'so': 0,
    'montag': 1, 'mo': 1,
    'dienstag': 2, 'di': 2,
    'mittwoch': 3, 'mi': 3,
    'donnerstag': 4, 'do': 4,
    'freitag': 5, 'fr': 5,
    'samstag': 6, 'sa': 6
  };

  // Check if text has weekday name
  if (!dateFound) {
    for (const [dayName, dayIndex] of Object.entries(weekdaysGerman)) {
      const weekdayRegex = new RegExp(`\\b(nächsten|nächster|nächste|am)?\\s*${dayName}\\b`, 'i');
      const match = text.match(weekdayRegex);
      if (match) {
        const isNextWeek = match[1] && match[1].toLowerCase().startsWith('nächst');
        const currentDayIndex = referenceDate.getDay();
        
        let daysToAdd = dayIndex - currentDayIndex;
        if (daysToAdd <= 0) daysToAdd += 7; // Target weekday is next week
        if (isNextWeek && dayIndex !== currentDayIndex) daysToAdd += 7; // force next week
        
        parsedDate.setDate(referenceDate.getDate() + daysToAdd);
        dateFound = true;
        break;
      }
    }
  }

  // Explicit Date (e.g. 15.07.2026, 15.07., 15.07)
  if (!dateFound) {
    // Matches DD.MM.YYYY or DD.MM. or DD.MM (makes trailing dot or year optional)
    const numericDateRegex = /\b(\d{1,2})\.(\d{1,2})\.?(?:(\d{4})\b)?/;
    const numMatch = text.match(numericDateRegex);
    if (numMatch) {
      const day = parseInt(numMatch[1], 10);
      const month = parseInt(numMatch[2], 10) - 1; // 0-indexed month
      const year = numMatch[3] ? parseInt(numMatch[3], 10) : referenceDate.getFullYear();
      
      parsedDate = new Date(year, month, day);
      // If year was omitted and date is in the past by > 3 months, assume next year
      if (!numMatch[3] && parsedDate < referenceDate && (referenceDate - parsedDate) > (1000 * 60 * 60 * 24 * 90)) {
        parsedDate.setFullYear(year + 1);
      }
      dateFound = true;
    }
  }

  // Month Names (e.g. "12. August" or "12 August" or "am 5. Juli")
  if (!dateFound) {
    const monthsGerman = [
      'januar', 'februar', 'märz', 'april', 'mai', 'juni', 
      'juli', 'august', 'september', 'oktober', 'november', 'dezember'
    ];
    for (let m = 0; m < 12; m++) {
      const monthName = monthsGerman[m];
      // Optional dot after the day number
      const monthRegex = new RegExp(`\\b(\\d{1,2})\\.?\\s*${monthName}\\b`, 'i');
      const match = text.match(monthRegex);
      if (match) {
        const day = parseInt(match[1], 10);
        const year = referenceDate.getFullYear();
        parsedDate = new Date(year, m, day);
        if (parsedDate < referenceDate && (referenceDate - parsedDate) > (1000 * 60 * 60 * 24 * 90)) {
          parsedDate.setFullYear(year + 1);
        }
        dateFound = true;
        break;
      }
    }
  }

  // Save parsed date locally
  const dateStr = formatLocalDate(parsedDate);
  result.startDate = dateStr;
  result.endDate = dateStr;

  // 4. Time Parsing
  let timeFound = false;

  // Handle German word hours: "halb [Stunde]" (e.g., halb drei -> 14:30)
  const halbRegex = /\bhalb\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|\d{1,2})\b/i;
  const halbMatch = text.match(halbRegex);
  if (halbMatch) {
    const hourWord = halbMatch[1].toLowerCase();
    const hourWordsMap = {
      'eins': 12, 'zwei': 13, 'drei': 14, 'vier': 15, 'fünf': 16, 'sechs': 17,
      'sieben': 18, 'acht': 19, 'neun': 20, 'zehn': 21, 'elf': 22, 'zwölf': 11
    };
    let hour = hourWordsMap[hourWord];
    if (hour === undefined) {
      const numHour = parseInt(hourWord, 10);
      if (!isNaN(numHour)) {
        hour = numHour - 1;
        if (hour < 12) hour += 12; // default to afternoon
      }
    }
    if (hour !== undefined) {
      result.startTime = `${String(hour).padStart(2, '0')}:30`;
      const endHour = hour + 1;
      result.endTime = `${String(endHour).padStart(2, '0')}:30`;
      timeFound = true;
    }
  }

  // Time range: "(von) [H:MM] bis [H:MM] Uhr" or "(von) [H] bis [H] Uhr" (makes 'von' optional)
  if (!timeFound) {
    const rangeRegex = /\b(?:von\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\s*bis\s*(\d{1,2})(?::(\d{2}))?\s*uhr\b/i;
    const rangeMatch = text.match(rangeRegex);
    if (rangeMatch) {
      let startH = parseInt(rangeMatch[1], 10);
      const startM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
      let endH = parseInt(rangeMatch[3], 10);
      const endM = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;

      if (startH < 8) startH += 12;
      if (endH < 8 || endH < startH) endH += 12;

      result.startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      result.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      timeFound = true;
    }
  }

  // Single Time with "Uhr" but optional "um/ab" (e.g. "Dienstag 14 Uhr", "um 14 Uhr")
  if (!timeFound) {
    const singleTimeUhrRegex = /\b(?:um|ab)?\s*(\d{1,2})(?::(\d{2}))?\s*uhr\b/i;
    const timeMatch = text.match(singleTimeUhrRegex);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      
      if (h < 8) h += 12;
      
      result.startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      let endH = h + 1;
      result.endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeFound = true;
    }
  }

  // Single Digital Time: "(um/ab) HH:MM" (e.g. "um 14:30")
  if (!timeFound) {
    const digitalTimeRegex = /\b(?:um|ab)?\s*(\d{1,2}):(\d{2})\b/i;
    const timeMatch = text.match(digitalTimeRegex);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      
      if (h < 8) h += 12;
      
      result.startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      let endH = h + 1;
      result.endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      timeFound = true;
    }
  }

  // Omit time altogether if allDay
  if (result.isAllDay) {
    result.startTime = '';
    result.endTime = '';
  }

  // 5. Clean up title
  // Strip out parsed time, dates, and relative expressions
  let cleanedTitle = text;
  
  // Strip range times
  cleanedTitle = cleanedTitle.replace(/\b(?:von\s+)?\d{1,2}(?::\d{2})?\s*(?:uhr)?\s*bis\s*\d{1,2}(?::\d{2})?\s*uhr\b/gi, '');
  // Strip single times with Uhr
  cleanedTitle = cleanedTitle.replace(/\b(?:um|ab)?\s*\d{1,2}(?::\d{2})?\s*uhr\b/gi, '');
  // Strip digital times
  cleanedTitle = cleanedTitle.replace(/\b(?:um|ab)?\s*\d{1,2}:\d{2}\b/gi, '');
  // Strip "halb [X]" expressions
  cleanedTitle = cleanedTitle.replace(/\bhalb\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|\d{1,2})\b/gi, '');
  // Strip relative date keywords (Unicode boundary safe)
  cleanedTitle = cleanedTitle.replace(/(?:^|[^a-zA-Z0-9äöüÄÖÜß])(heute|morgen|übermorgen)(?:$|[^a-zA-Z0-9äöüÄÖÜß])/gi, ' ');
  // Strip weekday phrases
  cleanedTitle = cleanedTitle.replace(/\b(nächsten|nächster|nächste|am)?\s*(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/gi, '');
  // Strip explicit date patterns
  cleanedTitle = cleanedTitle.replace(/\b\d{1,2}\.\d{1,2}\.?(?:\d{4})?\b/g, '');
  cleanedTitle = cleanedTitle.replace(/\b\d{1,2}\.?\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/gi, '');
  // Strip ganztägig keywords
  cleanedTitle = cleanedTitle.replace(/\b(ganztägig|ganztags|ganzen tag)\b/gi, '');
  
  // Strip common grammar particles and prepositions
  cleanedTitle = cleanedTitle.replace(/\b(am|um|den|im|ein|eine|einen|für|von|bis)\b/gi, ' ');
  // Clean up punctuation and whitespace
  cleanedTitle = cleanedTitle.replace(/[,.-]/g, ' ');
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();

  // Capitalize first letter of title
  if (cleanedTitle) {
    result.title = cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1);
  }

  return result;
}
