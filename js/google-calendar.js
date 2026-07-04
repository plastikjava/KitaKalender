class GoogleCalendarAPI {
  constructor() {
    this.clientId = localStorage.getItem('gcal_client_id') || '';
    this.calendarId = localStorage.getItem('gcal_calendar_id') || 'primary';
    this.accessToken = localStorage.getItem('gcal_access_token') || '';
    this.tokenExpiresAt = parseInt(localStorage.getItem('gcal_token_expires_at') || '0', 10);
    this.tokenClient = null;
    this.onAuthStatusChangeCallback = null;
  }

  isConfigured() {
    return this.clientId && this.calendarId;
  }

  updateConfig(clientId, calendarId) {
    this.clientId = clientId;
    this.calendarId = calendarId;
    localStorage.setItem('gcal_client_id', clientId);
    localStorage.setItem('gcal_calendar_id', calendarId);
    this.initTokenClient();
  }

  initTokenClient() {
    if (!this.clientId) return;
    
    try {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: 'https://www.googleapis.com/auth/calendar.events',
          callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              console.error('OAuth Error:', tokenResponse);
              return;
            }
            this.accessToken = tokenResponse.access_token;
            this.tokenExpiresAt = Date.now() + (tokenResponse.expires_in * 1000);
            
            localStorage.setItem('gcal_access_token', this.accessToken);
            localStorage.setItem('gcal_token_expires_at', this.tokenExpiresAt);
            
            if (this.onAuthStatusChangeCallback) {
              this.onAuthStatusChangeCallback(true);
            }
          },
        });
      } else {
        console.warn('Google Identity Services SDK not loaded yet.');
      }
    } catch (e) {
      console.error('Error initializing Token Client:', e);
    }
  }

  isLoggedIn() {
    return this.accessToken && Date.now() < this.tokenExpiresAt;
  }

  login() {
    if (!this.isConfigured()) {
      throw new Error('Bitte konfiguriere zuerst die Google Client-ID in den Einstellungen.');
    }
    if (!this.tokenClient) {
      this.initTokenClient();
    }
    if (this.tokenClient) {
      // Prompt user to select account and authorize
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      throw new Error('Google SDK konnte nicht initialisiert werden. Bitte lade die Seite neu.');
    }
  }

  logout() {
    if (this.accessToken) {
      try {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
          window.google.accounts.oauth2.revokeToken(this.accessToken, () => {});
        }
      } catch (e) {
        console.error('Error revoking token:', e);
      }
    }
    this.accessToken = '';
    this.tokenExpiresAt = 0;
    localStorage.removeItem('gcal_access_token');
    localStorage.removeItem('gcal_token_expires_at');
    
    if (this.onAuthStatusChangeCallback) {
      this.onAuthStatusChangeCallback(false);
    }
  }

  async fetchWithAuth(url, options = {}) {
    if (!this.isLoggedIn()) {
      // Attempt silent request if client is initialized
      if (this.tokenClient) {
        return new Promise((resolve, reject) => {
          this.tokenClient.requestAccessToken({ prompt: '' });
          // Note: Since this callback is async, we'll tell the user to log in again.
          reject(new Error('Sitzung abgelaufen. Bitte erneut anmelden.'));
        });
      }
      throw new Error('Nicht angemeldet. Bitte logge dich ein.');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      // Token expired, log out
      this.logout();
      throw new Error('Sitzung abgelaufen. Bitte melde dich erneut an.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try { errorJson = JSON.parse(errorText); } catch (e) {}
      const msg = errorJson?.error?.message || `Google API Fehler (${response.status})`;
      throw new Error(msg);
    }

    return response;
  }

  // LIST events
  async listEvents(timeMinISO, timeMaxISO) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events?` + 
      new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250'
      });

    const response = await this.fetchWithAuth(url);
    const data = await response.json();
    return data.items || [];
  }

  // CREATE event
  async createEvent(eventData) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`;
    const response = await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(this.formatEventForAPI(eventData))
    });
    return await response.json();
  }

  // UPDATE event
  async updateEvent(eventId, eventData) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${eventId}`;
    const response = await this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(this.formatEventForAPI(eventData))
    });
    return await response.json();
  }

  // DELETE event
  async deleteEvent(eventId) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events/${eventId}`;
    await this.fetchWithAuth(url, {
      method: 'DELETE'
    });
    return true;
  }

  // Format local event structure to Google Event Resource structure
  formatEventForAPI(localEvent) {
    const apiEvent = {
      summary: localEvent.title,
      description: localEvent.description || '',
    };

    // Store custom category in description using a tag [Kategorie: XYZ]
    if (localEvent.category) {
      apiEvent.description = `${apiEvent.description}\n\n[Kategorie: ${localEvent.category}]`.trim();
    }

    if (localEvent.isAllDay) {
      apiEvent.start = { date: localEvent.startDate }; // YYYY-MM-DD
      apiEvent.end = { date: localEvent.endDate }; // YYYY-MM-DD (Google demands next day for allDay end)
    } else {
      // Build ISO Date Time strings
      apiEvent.start = { dateTime: `${localEvent.startDate}T${localEvent.startTime}:00`, timeZone: 'Europe/Berlin' };
      apiEvent.end = { dateTime: `${localEvent.endDate}T${localEvent.endTime}:00`, timeZone: 'Europe/Berlin' };
    }

    return apiEvent;
  }

  // Parse Google Event Resource structure back to local event structure
  parseEventFromAPI(apiEvent) {
    const localEvent = {
      id: apiEvent.id,
      title: apiEvent.summary,
      description: apiEvent.description || '',
      category: 'team', // default
      isAllDay: false
    };

    // Extract category from tag in description
    const desc = apiEvent.description || '';
    const catMatch = desc.match(/\[Kategorie:\s*(\w+)\]/);
    if (catMatch && catMatch[1]) {
      localEvent.category = catMatch[1];
      // Clean up description for editing
      localEvent.description = desc.replace(/\[Kategorie:\s*\w+\]/, '').trim();
    } else {
      // Guess category based on keywords in title as fallback
      const titleLower = (apiEvent.summary || '').toLowerCase();
      if (titleLower.includes('eltern')) localEvent.category = 'eltern';
      else if (titleLower.includes('ausflug') || titleLower.includes('wald')) localEvent.category = 'ausflug';
      else if (titleLower.includes('wichtig') || titleLower.includes('achtung')) localEvent.category = 'wichtig';
      else if (titleLower.includes('fest') || titleLower.includes('feier')) localEvent.category = 'feier';
      else if (titleLower.includes('schließ') || titleLower.includes('schliess') || titleLower.includes('ferien')) localEvent.category = 'schliessung';
    }

    if (apiEvent.start.date) {
      localEvent.isAllDay = true;
      localEvent.startDate = apiEvent.start.date;
      
      // Google API returns exclusive date for allDay end. For local input, let's convert back
      // e.g. Start 2026-07-04, End 2026-07-05 (which means all day 4th July). Let's convert end to 2026-07-04
      const endDateVal = new Date(apiEvent.end.date);
      endDateVal.setDate(endDateVal.getDate() - 1);
      localEvent.endDate = endDateVal.toISOString().split('T')[0];
    } else {
      // Timed event
      // Extract dates and times
      const startDateTime = apiEvent.start.dateTime; // 2026-07-04T12:00:00+02:00
      const endDateTime = apiEvent.end.dateTime;

      localEvent.startDate = startDateTime.split('T')[0];
      localEvent.startTime = startDateTime.split('T')[1].substring(0, 5);
      localEvent.endDate = endDateTime.split('T')[0];
      localEvent.endTime = endDateTime.split('T')[1].substring(0, 5);
    }

    return localEvent;
  }
}

// Global Singleton Instance
const gcalAPI = new GoogleCalendarAPI();
