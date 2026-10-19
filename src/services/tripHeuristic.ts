export interface HeuristicTripResult {
  source: string;
  destination: string;
  budget: number | null;
  deadline: string | null;
  preferences: 'fastest' | 'cheapest' | 'balanced' | 'least_walking';
  usedAi: false;
}

const STOP_WORD_CUTOFF = /\s+(?:with|before|by|under|within|for|after|using|fastest|cheapest|quick|budget)\b.*$/i;

function cleanPlaceName(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(STOP_WORD_CUTOFF, '').trim();

  // Strip leading fillers
  cleaned = cleaned.replace(/^(?:i am|i'm|im|we are|take me|me|please|at|in|near|from)\s+/i, '').trim();
  // Strip trailing fillers
  cleaned = cleaned.replace(/\s+(?:please|fastest|cheapest|quick|urgent)$/i, '').trim();

  if (!cleaned) return '';

  // Preserve uppercase for short acronyms like CBS, RK, CCM, MIDC
  if (cleaned.length <= 4 && !cleaned.includes(' ')) {
    return cleaned.toUpperCase();
  }

  // Title case each word
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      if (w.toLowerCase() === 'cbs' || w.toLowerCase() === 'rk' || w.toLowerCase() === 'ccm') {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function parseDeadline(text: string): string | null {
  // Matches "before 6pm", "by 18:30", "at 6:15 pm", "6pm", "6:30 am", "18:00"
  const timeRegex = /(?:before|by|at|around)?\s*(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  // Look specifically near deadline words or time indicators
  const deadlineMatch = text.match(/(?:before|by|until|deadline|reach\s+by)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i) ||
    text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);

  if (!deadlineMatch) return null;

  let hour = parseInt(deadlineMatch[1], 10);
  const minute = deadlineMatch[2] ? parseInt(deadlineMatch[2], 10) : 0;
  const meridiem = deadlineMatch[3] ? deadlineMatch[3].toLowerCase() : null;

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function heuristicParseTrip(query: string): HeuristicTripResult {
  if (!query || typeof query !== 'string') {
    return {
      source: '',
      destination: '',
      budget: null,
      deadline: null,
      preferences: 'balanced',
      usedAi: false,
    };
  }

  // 1. Normalise: lowercase, replace punctuation with spaces, collapse spaces
  const normalized = query
    .toLowerCase()
    .replace(/[,.?!\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Extract budget
  let budget: number | null = null;
  const budgetMatch = normalized.match(/(?:(?:rs\.?|inr|₹|under|within|budget(?:\s+of)?)\s*(\d+)|(\d+)\s*(?:rs|rupees|inr|₹))/i);
  if (budgetMatch) {
    const val = budgetMatch[1] || budgetMatch[2];
    budget = parseInt(val, 10);
  }

  // 3. Extract deadline
  const deadline = parseDeadline(normalized);

  // 4. Extract preferences
  let preferences: HeuristicTripResult['preferences'] = 'balanced';
  if (/\b(fast|faster|fastest|quick|quicker|hurry|urgent|speed)\b/i.test(normalized)) {
    preferences = 'fastest';
  } else if (/\b(cheap|cheaper|cheapest|low cost|economy|budget)\b/i.test(normalized) || budget !== null) {
    preferences = 'cheapest';
  } else if (/\b(walk|comfort|less walk|least walk|rain)\b/i.test(normalized)) {
    preferences = 'least_walking';
  }

  // 5. Extract Source & Destination
  let rawSource = '';
  let rawDest = '';

  // Pattern 1: "from X to Y"
  const fromToMatch = normalized.match(/(?:^|\s)from\s+(.+?)\s+to\s+(.+?)(?=\s+(?:with|before|by|under|within|for|after|using|fastest|cheapest|quick|budget)\b|$)/i);
  if (fromToMatch) {
    rawSource = fromToMatch[1];
    rawDest = fromToMatch[2];
  } else {
    // Pattern 2: "(at|in|near) X ... (to|reach|going to) Y"
    const atToMatch = normalized.match(/(?:^|\s)(?:at|in|near)\s+(.+?)\s+(?:(?:take\s+me\s+)?to|reach|going\s+to)\s+(.+?)(?=\s+(?:with|before|by|under|within|for|after|using|fastest|cheapest|quick|budget)\b|$)/i);
    if (atToMatch) {
      rawSource = atToMatch[1];
      rawDest = atToMatch[2];
    } else {
      // Pattern 3: "X to Y"
      const xToYMatch = normalized.match(/^(.+?)\s+to\s+(.+?)(?=\s+(?:with|before|by|under|within|for|after|using|fastest|cheapest|quick|budget)\b|$)/i);
      if (xToYMatch) {
        rawSource = xToYMatch[1];
        rawDest = xToYMatch[2];
      } else {
        // Pattern 4: "take me to Y" / "going to Y" / "reach Y"
        const destOnlyMatch = normalized.match(/(?:(?:take\s+me\s+)?to|going\s+to|reach)\s+(.+?)(?=\s+(?:with|before|by|under|within|for|after|using|fastest|cheapest|quick|budget)\b|$)/i);
        if (destOnlyMatch) {
          rawDest = destOnlyMatch[1];
        }
      }
    }
  }

  return {
    source: cleanPlaceName(rawSource),
    destination: cleanPlaceName(rawDest),
    budget,
    deadline,
    preferences,
    usedAi: false,
  };
}
