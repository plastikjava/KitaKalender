// Helper to format local Date object to YYYY-MM-DD without timezone shifts
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

class CalendarRenderer {
  constructor(apiInstance) {
    this.api = apiInstance;
    this.currentDate = new Date();
    this.currentView = 'month'; // 'month', 'week', 'day', 'list'
    this.events = []; // Cache for current period events

    // DOM Elements
    this.views = {
      month: document.getElementById('monthView'),
      week: document.getElementById('weekView'),
      day: document.getElementById('dayView'),
      list: document.getElementById('listView')
    };
    
    this.titleEl = document.getElementById('currentDateTitle');
    this.loadingOverlay = document.getElementById('loadingOverlay');
  }

  setView(viewName) {
    if (!this.views[viewName]) return;
    this.currentView = viewName;
    
    // Toggle active view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Toggle active view container
    Object.keys(this.views).forEach(key => {
      this.views[key].classList.toggle('hidden', key !== viewName);
    });

    this.refresh();
  }

  next() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
    } else if (this.currentView === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
    } else if (this.currentView === 'list') {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    }
    this.refresh();
  }

  prev() {
    if (this.currentView === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    } else if (this.currentView === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
    } else if (this.currentView === 'day') {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
    } else if (this.currentView === 'list') {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    }
    this.refresh();
  }

  today() {
    this.currentDate = new Date();
    this.refresh();
  }

  showLoading(show) {
    if (show) {
      this.loadingOverlay.classList.remove('hidden');
    } else {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  // Get date range for current view
  getDateRange() {
    const d = new Date(this.currentDate);
    let start, end;

    if (this.currentView === 'month' || this.currentView === 'list') {
      // Start of month
      start = new Date(d.getFullYear(), d.getMonth(), 1);
      // End of month (plus buffer for grid overflow)
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      // Add padding for previous/next month days in grid
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);
    } else if (this.currentView === 'week') {
      // Find Monday of current week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      start = new Date(d.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (this.currentView === 'day') {
      start = new Date(d);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }

    return {
      min: start.toISOString(),
      max: end.toISOString()
    };
  }

  // Load events and render
  async refresh() {
    this.updateTitle();

    if (!this.api.isLoggedIn()) {
      this.renderPlaceholder('Bitte melde dich mit Google an, um den Kalender anzuzeigen.');
      return;
    }

    this.showLoading(true);
    try {
      const range = this.getDateRange();
      const apiEvents = await this.api.listEvents(range.min, range.max);
      this.events = apiEvents.map(event => this.api.parseEventFromAPI(event));
      this.render();
    } catch (error) {
      console.error(error);
      this.renderPlaceholder(`Fehler beim Laden des Kalenders: ${error.message}`);
      showToast(error.message, 'danger');
    } finally {
      this.showLoading(false);
    }
  }

  updateTitle() {
    const options = { month: 'long', year: 'numeric' };
    const locale = 'de-DE';
    
    if (this.currentView === 'day') {
      this.titleEl.textContent = this.currentDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (this.currentView === 'week') {
      const range = this.getDateRange();
      const start = new Date(range.min);
      // Week display needs to adjust actual dates to exclude buffers
      const day = this.currentDate.getDay();
      const diff = this.currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const actualStart = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), diff);
      const actualEnd = new Date(actualStart);
      actualEnd.setDate(actualEnd.getDate() + 6);
      
      const startStr = actualStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      const endStr = actualEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      this.titleEl.textContent = `${startStr} – ${endStr}`;
    } else {
      this.titleEl.textContent = this.currentDate.toLocaleDateString(locale, options);
    }
  }

  renderPlaceholder(message) {
    // Clear all views and inject placeholder
    Object.values(this.views).forEach(view => {
      view.innerHTML = `
        <div class="calendar-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; text-align: center; color: var(--text-muted); gap: 12px; padding: 24px;">
          <i class="ti ti-calendar-off" style="font-size: 3rem; color: var(--primary);"></i>
          <p style="font-size: 1.1rem; font-weight: 500;">${message}</p>
        </div>
      `;
    });
  }

  render() {
    // Dispatch to specific view renderer
    if (this.currentView === 'month') this.renderMonth();
    else if (this.currentView === 'week') this.renderWeek();
    else if (this.currentView === 'day') this.renderDay();
    else if (this.currentView === 'list') this.renderList();
  }

  // --- RENDER MONTH VIEW ---
  renderMonth() {
    const container = this.views.month;
    container.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Day headers (Mon - Fri)
    const daysOfWeek = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    const headerRow = document.createElement('div');
    headerRow.className = 'month-view-header';
    daysOfWeek.forEach(day => {
      const col = document.createElement('div');
      col.textContent = day;
      headerRow.appendChild(col);
    });
    container.appendChild(headerRow);

    // Month grid wrapper
    const grid = document.createElement('div');
    grid.className = 'month-view-grid';

    // First day of month
    const firstDayOfMonth = new Date(year, month, 1);
    const firstDayIndex = firstDayOfMonth.getDay(); // Sun=0, Mon=1...
    // Calculate difference to find the Monday of the first grid week
    const diff = firstDayIndex === 0 ? -6 : 1 - firstDayIndex;
    const startDate = new Date(year, month, 1);
    startDate.setDate(startDate.getDate() + diff);
    startDate.setHours(0,0,0,0);

    const todayStr = formatLocalDate(new Date());

    // Loop through 6 weeks, 5 days per week (Monday to Friday)
    for (let w = 0; w < 6; w++) {
      for (let d = 0; d < 5; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + (w * 7) + d);
        const cellDateStr = formatLocalDate(cellDate);

        const cell = document.createElement('div');
        cell.className = 'month-day';
        
        // Check if date belongs to previous/next month for styling
        if (cellDate.getMonth() !== month) {
          cell.classList.add('other-month');
        }
        
        cell.innerHTML = `<span class="month-day-number">${cellDate.getDate()}</span>`;

        if (cellDateStr === todayStr) {
          cell.classList.add('today');
        }

        cell.dataset.date = cellDateStr;

        // Add click to cell for creating event
        cell.addEventListener('click', (e) => {
          if (e.target.closest('.event-badge')) return;
          openEventModal({ startDate: cell.dataset.date, endDate: cell.dataset.date });
        });

        // Render events for this day (including weekend events if this day is Friday)
        const dayEventsContainer = document.createElement('div');
        dayEventsContainer.className = 'month-events-container';
        
        const isFriday = cellDate.getDay() === 5;
        const saturdayStr = isFriday ? formatLocalDate(new Date(new Date(cellDate).setDate(cellDate.getDate() + 1))) : '';
        const sundayStr = isFriday ? formatLocalDate(new Date(new Date(cellDate).setDate(cellDate.getDate() + 2))) : '';

        const dayEvents = this.events.filter(event => {
          const start = event.startDate;
          const end = event.endDate;
          
          const matchesCell = cellDateStr >= start && cellDateStr <= end;
          const matchesWeekend = isFriday && (
            (saturdayStr >= start && saturdayStr <= end) ||
            (sundayStr >= start && sundayStr <= end)
          );
          
          return matchesCell || matchesWeekend;
        });

        dayEvents.forEach(event => {
          const badge = document.createElement('div');
          
          // Check if it is a weekend event
          let prefix = '';
          let isWeekendEvent = false;
          if (event.startDate === saturdayStr || event.endDate === saturdayStr) {
            prefix = '🗓️ Sa: ';
            isWeekendEvent = true;
          } else if (event.startDate === sundayStr || event.endDate === sundayStr) {
            prefix = '🗓️ So: ';
            isWeekendEvent = true;
          }

          badge.className = `event-badge event-cat-${event.category}`;
          if (isWeekendEvent) {
            badge.classList.add('event-weekend-badge');
          }
          
          const timeStr = event.isAllDay ? '' : `${event.startTime} `;
          badge.textContent = `${prefix}${timeStr}${event.title}`;
          badge.title = `${event.title} (${event.isAllDay ? 'Ganztägig' : event.startTime + ' - ' + event.endTime})`;
          
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventModal(event);
          });

          dayEventsContainer.appendChild(badge);
        });

        cell.appendChild(dayEventsContainer);
        grid.appendChild(cell);
      }
    }

    container.appendChild(grid);
  }

  // --- RENDER WEEK VIEW ---
  renderWeek() {
    const container = this.views.week;
    container.innerHTML = '';

    const weekWrapper = document.createElement('div');
    weekWrapper.className = 'week-view-container';

    // Time Axis Column
    const timeAxis = document.createElement('div');
    timeAxis.className = 'time-axis';
    for (let h = 0; h < 24; h++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      slot.textContent = `${h}:00`;
      timeAxis.appendChild(slot);
    }
    weekWrapper.appendChild(timeAxis);

    // Calculate dates of the current week (Mon-Sun)
    const d = new Date(this.currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);

    const todayStr = formatLocalDate(new Date());

    // Day Columns (Mon-Fri)
    for (let i = 0; i < 5; i++) {
      const columnDate = new Date(monday);
      columnDate.setDate(monday.getDate() + i);
      const colDateStr = formatLocalDate(columnDate);

      const col = document.createElement('div');
      col.className = 'week-column';
      col.dataset.date = colDateStr;

      // Header
      const header = document.createElement('div');
      header.className = 'week-column-header';
      if (colDateStr === todayStr) header.classList.add('today');
      
      const weekdayStr = columnDate.toLocaleDateString('de-DE', { weekday: 'short' });
      const dayNumStr = columnDate.getDate();
      header.innerHTML = `<div>${weekdayStr}</div><div style="font-size: 1.2rem; font-weight: 700;">${dayNumStr}</div>`;
      col.appendChild(header);

      // Hour Grid Lines
      for (let h = 0; h < 24; h++) {
        const line = document.createElement('div');
        line.className = 'hour-grid-line';
        line.style.top = `${h * 60 + 56}px`; // offset header height
        col.appendChild(line);
      }

      // Add click listener on grid to add event
      col.addEventListener('click', (e) => {
        if (e.target.closest('.timed-event-badge')) return;
        const rect = col.getBoundingClientRect();
        const clickY = e.clientY - rect.top - 56; // remove header offset
        if (clickY < 0) return; // clicked header
        const hour = Math.floor(clickY / 60);
        const timeVal = `${String(hour).padStart(2, '0')}:00`;
        openEventModal({ startDate: colDateStr, endDate: colDateStr, startTime: timeVal });
      });

      // Filter and render events for this column day (including weekend events if Friday)
      const isFriday = i === 4;
      const saturdayStr = isFriday ? formatLocalDate(new Date(new Date(columnDate).setDate(columnDate.getDate() + 1))) : '';
      const sundayStr = isFriday ? formatLocalDate(new Date(new Date(columnDate).setDate(columnDate.getDate() + 2))) : '';

      const colEvents = this.events.filter(event => {
        const matchesCol = colDateStr >= event.startDate && colDateStr <= event.endDate;
        const matchesWeekend = isFriday && (
          (saturdayStr >= event.startDate && saturdayStr <= event.endDate) ||
          (sundayStr >= event.startDate && sundayStr <= event.endDate)
        );
        return matchesCol || matchesWeekend;
      });

      colEvents.forEach(event => {
        let prefix = '';
        let isWeekendEvent = false;
        if (event.startDate === saturdayStr || event.endDate === saturdayStr) {
          prefix = '🗓️ Sa: ';
          isWeekendEvent = true;
        } else if (event.startDate === sundayStr || event.endDate === sundayStr) {
          prefix = '🗓️ So: ';
          isWeekendEvent = true;
        }

        const badge = document.createElement('div');
        
        // Render weekend events in Friday header
        if (event.isAllDay || isWeekendEvent) {
          badge.className = `event-badge event-cat-${event.category}`;
          if (isWeekendEvent) {
            badge.classList.add('event-weekend-badge');
          }
          badge.style.margin = '4px';
          
          let timeLabel = '';
          if (isWeekendEvent && !event.isAllDay) {
            timeLabel = ` (${event.startTime})`;
          }
          badge.textContent = `${prefix}${event.title}${timeLabel}`;
          
          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventModal(event);
          });
          header.appendChild(badge);
        } else {
          // Timed event positioned on axis
          badge.className = `timed-event-badge event-cat-${event.category}`;
          
          const [startHour, startMin] = event.startTime.split(':').map(Number);
          const [endHour, endMin] = event.endTime.split(':').map(Number);
          
          const startOffsetMinutes = startHour * 60 + startMin;
          const endOffsetMinutes = endHour * 60 + endMin;
          const durationMinutes = endOffsetMinutes - startOffsetMinutes;

          const topPos = (startOffsetMinutes / 60) * 60 + 56; // 56px header offset
          const heightPos = (durationMinutes / 60) * 60;

          badge.style.top = `${topPos}px`;
          badge.style.height = `${Math.max(30, heightPos)}px`; // Minimum 30px height

          badge.innerHTML = `
            <span class="timed-event-time">${event.startTime} - ${event.endTime}</span>
            <span style="font-weight: 600;">${event.title}</span>
          `;

          badge.addEventListener('click', (e) => {
            e.stopPropagation();
            openEventModal(event);
          });

          col.appendChild(badge);
        }
      });

      weekWrapper.appendChild(col);
    }

    container.appendChild(weekWrapper);
    
    // Auto Scroll to 07:00 AM to make it feel better
    setTimeout(() => {
      const scrollPos = 7 * 60; // 7am
      weekWrapper.scrollTop = scrollPos;
    }, 10);
  }

  // --- RENDER DAY VIEW ---
  renderDay() {
    const container = this.views.day;
    container.innerHTML = '';

    const dayWrapper = document.createElement('div');
    dayWrapper.className = 'day-view-container';

    // Time Axis Column
    const timeAxis = document.createElement('div');
    timeAxis.className = 'time-axis';
    for (let h = 0; h < 24; h++) {
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      slot.textContent = `${h}:00`;
      timeAxis.appendChild(slot);
    }
    dayWrapper.appendChild(timeAxis);

    const colDateStr = formatLocalDate(this.currentDate);

    const col = document.createElement('div');
    col.className = 'week-column';
    col.dataset.date = colDateStr;

    // Header
    const header = document.createElement('div');
    header.className = 'week-column-header';
    const weekdayStr = this.currentDate.toLocaleDateString('de-DE', { weekday: 'long' });
    const dayNumStr = this.currentDate.getDate();
    header.innerHTML = `<div>${weekdayStr}</div><div style="font-size: 1.2rem; font-weight: 700;">${dayNumStr}</div>`;
    col.appendChild(header);

    // Hour Grid Lines
    for (let h = 0; h < 24; h++) {
      const line = document.createElement('div');
      line.className = 'hour-grid-line';
      line.style.top = `${h * 60 + 56}px`;
      col.appendChild(line);
    }

    // Click on day grid to add event
    col.addEventListener('click', (e) => {
      if (e.target.closest('.timed-event-badge')) return;
      const rect = col.getBoundingClientRect();
      const clickY = e.clientY - rect.top - 56;
      if (clickY < 0) return;
      const hour = Math.floor(clickY / 60);
      const timeVal = `${String(hour).padStart(2, '0')}:00`;
      openEventModal({ startDate: colDateStr, endDate: colDateStr, startTime: timeVal });
    });

    // Render events
    const dayEvents = this.events.filter(event => {
      return colDateStr >= event.startDate && colDateStr <= event.endDate;
    });

    dayEvents.forEach(event => {
      const badge = document.createElement('div');
      
      if (event.isAllDay) {
        badge.className = `event-badge event-cat-${event.category}`;
        badge.style.margin = '4px';
        badge.textContent = `[Ganztägig] ${event.title}`;
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          openEventModal(event);
        });
        header.appendChild(badge);
      } else {
        badge.className = `timed-event-badge event-cat-${event.category}`;
        
        const [startHour, startMin] = event.startTime.split(':').map(Number);
        const [endHour, endMin] = event.endTime.split(':').map(Number);
        
        const startOffsetMinutes = startHour * 60 + startMin;
        const endOffsetMinutes = endHour * 60 + endMin;
        const durationMinutes = endOffsetMinutes - startOffsetMinutes;

        const topPos = (startOffsetMinutes / 60) * 60 + 56;
        const heightPos = (durationMinutes / 60) * 60;

        badge.style.top = `${topPos}px`;
        badge.style.height = `${Math.max(30, heightPos)}px`;

        badge.innerHTML = `
          <span class="timed-event-time">${event.startTime} - ${event.endTime}</span>
          <span style="font-weight: 600; font-size: 1rem;">${event.title}</span>
          ${event.description ? `<span style="font-size: 0.85rem; opacity: 0.9; margin-top: 4px;">${event.description}</span>` : ''}
        `;

        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          openEventModal(event);
        });

        col.appendChild(badge);
      }
    });

    dayWrapper.appendChild(col);
    container.appendChild(dayWrapper);
    
    // Auto Scroll to 07:00 AM
    setTimeout(() => {
      dayWrapper.scrollTop = 7 * 60;
    }, 10);
  }

  // --- RENDER LIST VIEW (IPAD LOBBY) ---
  renderList() {
    const container = this.views.list;
    container.innerHTML = '';

    const listWrapper = document.createElement('div');
    listWrapper.className = 'list-view';

    const headerTitle = document.createElement('h2');
    headerTitle.className = 'list-view-title';
    headerTitle.innerHTML = `<i class="ti ti-layout-list"></i> Kita Info-Board (Kommende Termine)`;
    listWrapper.appendChild(headerTitle);

    // Group events by date
    const eventsByDate = {};
    
    // Sort events
    const sortedEvents = [...this.events].sort((a, b) => {
      // Sort by date first, then by time
      if (a.startDate !== b.startDate) {
        return a.startDate.localeCompare(b.startDate);
      }
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    sortedEvents.forEach(event => {
      // Event can span multiple days. For the list, let's list it under its start date
      // or duplicate it for days within our active range? For an info list, start date is usually preferred.
      const dateKey = event.startDate;
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    });

    const dates = Object.keys(eventsByDate).sort();
    
    if (dates.length === 0) {
      listWrapper.innerHTML += `
        <div style="text-align: center; padding: 48px; color: var(--text-muted);">
          <i class="ti ti-circle-check" style="font-size: 4rem; color: var(--success); margin-bottom: 12px; display: block;"></i>
          <p style="font-size: 1.2rem; font-weight: 500;">Keine anstehenden Termine in diesem Monat!</p>
        </div>
      `;
      container.appendChild(listWrapper);
      return;
    }

    const todayStr = formatLocalDate(new Date());

    dates.forEach(dateStr => {
      const dateEvents = eventsByDate[dateStr];
      const dateObj = new Date(dateStr);
      
      const dayGroup = document.createElement('div');
      dayGroup.className = 'list-day-group';

      const dayHeader = document.createElement('div');
      dayHeader.className = 'list-day-header';
      if (dateStr === todayStr) dayHeader.classList.add('today');

      const weekdayName = dateObj.toLocaleDateString('de-DE', { weekday: 'long' });
      const fullDateStr = dateObj.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
      
      dayHeader.innerHTML = `
        <span>${weekdayName}</span>
        <span style="font-weight: 500; font-size: 1rem; opacity: 0.8;">${fullDateStr}</span>
      `;
      dayGroup.appendChild(dayHeader);

      dateEvents.forEach(event => {
        const card = document.createElement('div');
        card.className = `list-event-card event-cat-${event.category}`;

        const timeVal = event.isAllDay ? 'Ganztägig' : `${event.startTime} - ${event.endTime}`;
        
        let catText = 'Team-intern';
        if (event.category === 'eltern') catText = 'Eltern';
        else if (event.category === 'ausflug') catText = 'Ausflug';
        else if (event.category === 'wichtig') catText = 'Wichtig!';
        else if (event.category === 'feier') catText = 'Feier/Fest';
        else if (event.category === 'schliessung') catText = 'Schließtag';

        card.innerHTML = `
          <div class="list-event-time">${timeVal}</div>
          <div class="list-event-title-box">
            <div class="list-event-title">${event.title}</div>
            ${event.description ? `<div class="list-event-desc">${event.description}</div>` : ''}
          </div>
          <div class="list-event-tag">${catText}</div>
        `;

        card.addEventListener('click', () => {
          openEventModal(event);
        });

        dayGroup.appendChild(card);
      });

      listWrapper.appendChild(dayGroup);
    });

    container.appendChild(listWrapper);
  }
}
