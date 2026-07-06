// Helper to format local Date object to YYYY-MM-DD without timezone shifts
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Global references
let renderer;
let confirmModal, eventModal, settingsModal;
let eventForm, settingsForm;

// Event Form fields
let eventIdInput, eventTitleInput, eventStartDateInput, eventStartTimeInput, eventEndDateInput, eventEndTimeInput;
let eventAllDayCheckbox, eventCategorySelect, eventDescriptionInput, deleteEventBtn;

// Confirm Modal fields
let confirmTitleInput, confirmDateInput, confirmTimeInput, confirmDurationSelect, confirmCategorySelect, confirmOriginalTextEl;

// Toast notifications helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ti-circle-check';
  if (type === 'danger') icon = 'ti-circle-x';
  if (type === 'warning') icon = 'ti-alert-circle';
  
  toast.innerHTML = `<i class="ti ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  // Fade out and remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

// Modal open/close helpers
function openModal(modal) {
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modal) {
  if (modal) modal.classList.add('hidden');
}

// Open manual event modal
function openEventModal(eventData = {}) {
  if (!eventModal) return;
  
  // Clear/Set fields
  eventIdInput.value = eventData.id || '';
  eventTitleInput.value = eventData.title || '';
  
  const todayISO = formatLocalDate(new Date());
  eventStartDateInput.value = eventData.startDate || todayISO;
  eventEndDateInput.value = eventData.endDate || eventData.startDate || todayISO;
  
  eventStartTimeInput.value = eventData.startTime || '09:00';
  eventEndTimeInput.value = eventData.endTime || '10:00';
  
  eventAllDayCheckbox.checked = eventData.isAllDay || false;
  eventCategorySelect.value = eventData.category || 'team';
  eventDescriptionInput.value = eventData.description || '';

  // Toggle time group visibility
  toggleTimeInputsVisibility(eventAllDayCheckbox.checked);

  // Set modal title & delete button
  const modalTitle = document.getElementById('eventModalTitle');
  if (eventData.id) {
    if (modalTitle) modalTitle.textContent = 'Termin bearbeiten';
    deleteEventBtn.classList.remove('hidden');
  } else {
    if (modalTitle) modalTitle.textContent = 'Termin hinzufügen';
    deleteEventBtn.classList.add('hidden');
  }

  // Render quick templates
  renderTemplates('templateTags', (template) => {
    // Populate form from template
    eventTitleInput.value = template.title;
    eventCategorySelect.value = template.category;
    eventDescriptionInput.value = template.description || '';
    eventAllDayCheckbox.checked = template.isAllDay || false;
    toggleTimeInputsVisibility(template.isAllDay || false);
    
    if (!template.isAllDay) {
      eventStartTimeInput.value = template.startTime || '09:00';
      // Calculate end time based on duration
      if (template.duration) {
        const [h, m] = eventStartTimeInput.value.split(':').map(Number);
        const startMin = h * 60 + m;
        const endMin = startMin + parseInt(template.duration, 10);
        const endH = Math.floor(endMin / 60) % 24;
        const endM = endMin % 60;
        eventEndTimeInput.value = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }
    }
  });

  openModal(eventModal);
}

function toggleTimeInputsVisibility(isAllDay) {
  const startGroup = document.getElementById('startTimeGroup');
  const endGroup = document.getElementById('endTimeGroup');
  if (startGroup) startGroup.style.display = isAllDay ? 'none' : 'block';
  if (endGroup) endGroup.style.display = isAllDay ? 'none' : 'block';
}

// Main App Initialization
function initApp() {
  console.log('Initializing Kita Kalender App...');
  
  // 1. Initialize DOM references
  confirmModal = document.getElementById('confirmModal');
  eventModal = document.getElementById('eventModal');
  settingsModal = document.getElementById('settingsModal');

  eventForm = document.getElementById('eventForm');
  settingsForm = document.getElementById('settingsForm');

  eventIdInput = document.getElementById('eventId');
  eventTitleInput = document.getElementById('eventTitle');
  eventStartDateInput = document.getElementById('eventStartDate');
  eventStartTimeInput = document.getElementById('eventStartTime');
  eventEndDateInput = document.getElementById('eventEndDate');
  eventEndTimeInput = document.getElementById('eventEndTime');
  eventAllDayCheckbox = document.getElementById('eventAllDay');
  eventCategorySelect = document.getElementById('eventCategory');
  eventDescriptionInput = document.getElementById('eventDescription');
  deleteEventBtn = document.getElementById('deleteEventBtn');

  confirmTitleInput = document.getElementById('confirmTitle');
  confirmDateInput = document.getElementById('confirmDate');
  confirmTimeInput = document.getElementById('confirmTime');
  confirmDurationSelect = document.getElementById('confirmDuration');
  confirmCategorySelect = document.getElementById('confirmCategory');
  confirmOriginalTextEl = document.getElementById('confirmOriginalText');

  // 2. Initialize Calendar Renderer
  renderer = new CalendarRenderer(gcalAPI);

  // 3. Bind Header Controls
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userName = document.getElementById('userName');
  const settingsBtn = document.getElementById('settingsBtn');

  // Load configuration inputs into settings form
  const clientInput = document.getElementById('settingsClientId');
  const calendarInput = document.getElementById('settingsCalendarId');
  if (clientInput) clientInput.value = gcalAPI.clientId;
  if (calendarInput) calendarInput.value = gcalAPI.calendarId;

  // Bind auth triggers
  gcalAPI.onAuthStatusChangeCallback = (isLoggedIn) => {
    if (isLoggedIn) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userInfo) userInfo.classList.remove('hidden');
      if (userName) userName.textContent = 'Mitarbeiter (Angemeldet)';
      showToast('Erfolgreich mit Google Kalender verbunden!');
      renderer.refresh();
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userInfo) userInfo.classList.add('hidden');
      renderer.refresh();
    }
  };

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      try {
        gcalAPI.login();
      } catch (e) {
        showToast(e.message, 'warning');
        openModal(settingsModal);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      gcalAPI.logout();
      showToast('Erfolgreich abgemeldet.');
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      console.log('Settings gear clicked');
      if (settingsModal) {
        settingsModal.classList.remove('hidden');
        // Force inline styles as a fallback to bypass any CSS overrides
        settingsModal.style.opacity = '1';
        settingsModal.style.pointerEvents = 'auto';
        showToast('Einstellungen geöffnet', 'info');
      } else {
        showToast('Fehler: settingsModal Element fehlt!', 'danger');
      }
    });
  }

  const resetAppBtn = document.getElementById('resetAppBtn');
  if (resetAppBtn) {
    resetAppBtn.addEventListener('click', () => {
      if (confirm('Möchtest du alle lokalen Einstellungen zurücksetzen?')) {
        localStorage.removeItem('gcal_client_id');
        localStorage.removeItem('gcal_calendar_id');
        localStorage.removeItem('gcal_access_token');
        localStorage.removeItem('gcal_token_expires_at');
        showToast('App zurückgesetzt. Lade neu...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    });
  }

  // Settings Save Form
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cId = document.getElementById('settingsClientId').value.trim();
      const calId = document.getElementById('settingsCalendarId').value.trim();
      
      gcalAPI.updateConfig(cId, calId);
      closeModal(settingsModal);
      showToast('Einstellungen gespeichert.');
      
      // Refresh connection
      if (gcalAPI.isConfigured()) {
        gcalAPI.initTokenClient();
        try {
          gcalAPI.login();
        } catch (e) {
          showToast(e.message, 'warning');
        }
      }
    });
  }

  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  if (cancelSettingsBtn) {
    cancelSettingsBtn.addEventListener('click', () => closeModal(settingsModal));
  }

  // Calendar view navigation
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const todayBtn = document.getElementById('todayBtn');

  if (prevBtn) prevBtn.addEventListener('click', () => renderer.prev());
  if (nextBtn) nextBtn.addEventListener('click', () => renderer.next());
  if (todayBtn) todayBtn.addEventListener('click', () => renderer.today());

  // View selector buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderer.setView(btn.dataset.view);
    });
  });

  // FAB Event add
  const fabAdd = document.getElementById('fabAdd');
  if (fabAdd) {
    fabAdd.addEventListener('click', () => {
      openEventModal();
    });
  }

  // Close modals buttons
  document.querySelectorAll('.close-modal-btn, #cancelEventBtn, #confirmCancelBtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal'));
    });
  });

  // All day checkbox change
  if (eventAllDayCheckbox) {
    eventAllDayCheckbox.addEventListener('change', () => {
      toggleTimeInputsVisibility(eventAllDayCheckbox.checked);
    });
  }

  // Event Manual Form Submit
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const eventData = {
        title: eventTitleInput.value.trim(),
        startDate: eventStartDateInput.value,
        endDate: eventEndDateInput.value,
        startTime: eventStartTimeInput.value,
        endTime: eventEndTimeInput.value,
        isAllDay: eventAllDayCheckbox.checked,
        category: eventCategorySelect.value,
        description: eventDescriptionInput.value.trim()
      };

      // Validations
      if (!eventData.isAllDay) {
        if (eventData.startDate === eventData.endDate && eventData.startTime >= eventData.endTime) {
          showToast('Die Endzeit muss nach der Startzeit liegen.', 'warning');
          return;
        }
      } else {
        const start = new Date(eventData.startDate + 'T00:00:00');
        const end = new Date(eventData.endDate + 'T00:00:00');
        if (end < start) {
          showToast('Das Enddatum darf nicht vor dem Startdatum liegen.', 'warning');
          return;
        }
        
        // Adjust for Google API exclusive end date
        const adjustedEnd = new Date(end);
        adjustedEnd.setDate(adjustedEnd.getDate() + 1);
        eventData.endDate = formatLocalDate(adjustedEnd);
      }

      renderer.showLoading(true);
      closeModal(eventModal);
      
      try {
        const id = eventIdInput.value;
        if (id) {
          await gcalAPI.updateEvent(id, eventData);
          showToast('Termin erfolgreich aktualisiert!');
        } else {
          await gcalAPI.createEvent(eventData);
          showToast('Termin erfolgreich erstellt!');
        }
        renderer.refresh();
      } catch (err) {
        console.error(err);
        showToast(`Fehler: ${err.message}`, 'danger');
      } finally {
        renderer.showLoading(false);
      }
    });
  }

  // Delete event
  if (deleteEventBtn) {
    deleteEventBtn.addEventListener('click', async () => {
      const id = eventIdInput.value;
      if (!id) return;
      
      if (confirm('Möchtest du diesen Termin wirklich löschen?')) {
        renderer.showLoading(true);
        closeModal(eventModal);
        
        try {
          await gcalAPI.deleteEvent(id);
          showToast('Termin gelöscht.');
          renderer.refresh();
        } catch (err) {
          console.error(err);
          showToast(`Löschen fehlgeschlagen: ${err.message}`, 'danger');
        } finally {
          renderer.showLoading(false);
        }
      }
    });
  }

  // --- Native Speech Recognition ---
  const micBtn = document.getElementById('micBtn');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (micBtn) {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      let isRecording = false;
      
      micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRecording) {
          recognition.stop();
        } else {
          try {
            recognition.start();
            isRecording = true;
            micBtn.classList.add('recording');
            showToast('Sprachaufnahme gestartet. Ich höre zu...', 'info');
          } catch (err) {
            console.error('Speech Start Error:', err);
            showToast('Spracherkennung konnte nicht gestartet werden.', 'danger');
          }
        }
      });
      
      recognition.addEventListener('result', (event) => {
        const text = event.results[0][0].transcript;
        if (quickInput) {
          quickInput.value = text;
        }
        showToast('Sprache erkannt: "' + text + '". Klicke auf den Pfeil zum Eintragen.', 'success');
      });
      
      recognition.addEventListener('end', () => {
        isRecording = false;
        micBtn.classList.remove('recording');
      });
      
      recognition.addEventListener('error', (event) => {
        console.error('Speech Error:', event.error);
        if (event.error !== 'no-speech') {
          showToast('Fehler bei der Spracherkennung: ' + event.error, 'danger');
        }
        isRecording = false;
        micBtn.classList.remove('recording');
      });
      
    } else {
      micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showToast('Spracherkennung in diesem Browser nicht unterstützt. Nutze die Tastatur-Diktierfunktion.', 'warning');
      });
    }
  }

  // --- Voice / Quick Input Parsing ---
  const quickInput = document.getElementById('quickInput');
  const parseBtn = document.getElementById('parseBtn');

  function handleQuickInputSubmit() {
    const value = quickInput.value.trim();
    if (!value) return;

    // Run local German NLP parser
    const parsed = parseGermanEventText(value);

    // Populate Confirm Modal
    confirmTitleInput.value = parsed.title;
    confirmDateInput.value = parsed.startDate;
    confirmTimeInput.value = parsed.startTime || '09:00';
    
    // Choose correct duration in dropdown
    if (parsed.isAllDay) {
      confirmDurationSelect.value = '0';
    } else {
      confirmDurationSelect.value = '60'; // Default 1 hour
    }
    
    confirmCategorySelect.value = parsed.category;
    confirmOriginalTextEl.textContent = value;

    // Show confirm dialog
    openModal(confirmModal);
  }

  if (quickInput) {
    quickInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleQuickInputSubmit();
      }
    });
  }

  if (parseBtn) {
    parseBtn.addEventListener('click', handleQuickInputSubmit);
  }

  // Confirm Modal Save
  const confirmSaveBtn = document.getElementById('confirmSaveBtn');
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', async () => {
      const isAllDay = confirmDurationSelect.value === '0';
      const durationMin = parseInt(confirmDurationSelect.value, 10);
      const startDate = confirmDateInput.value;
      
      const eventData = {
        title: confirmTitleInput.value.trim(),
        startDate: startDate,
        endDate: startDate,
        startTime: isAllDay ? '' : confirmTimeInput.value,
        endTime: '',
        isAllDay: isAllDay,
        category: confirmCategorySelect.value,
        description: 'Erstellt per Spracheingabe.'
      };

      if (!isAllDay) {
        const [h, m] = eventData.startTime.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + durationMin;
        const endH = Math.floor(endMinutes / 60) % 24;
        const endM = endMinutes % 60;
        eventData.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        
        if (endMinutes >= 1440) {
          const nextDay = new Date(startDate + 'T00:00:00');
          nextDay.setDate(nextDay.getDate() + 1);
          eventData.endDate = formatLocalDate(nextDay);
        }
      } else {
        const end = new Date(startDate + 'T00:00:00');
        end.setDate(end.getDate() + 1);
        eventData.endDate = formatLocalDate(end);
      }

      renderer.showLoading(true);
      closeModal(confirmModal);
      
      try {
        await gcalAPI.createEvent(eventData);
        showToast('Termin per Spracheingabe erfolgreich hinzugefügt!');
        quickInput.value = '';
        renderer.refresh();
      } catch (err) {
        console.error(err);
        showToast(`Fehler: ${err.message}`, 'danger');
      } finally {
        renderer.showLoading(false);
      }
    });
  }

  // Try auto-login on startup
  setTimeout(() => {
    if (gcalAPI.isConfigured()) {
      gcalAPI.initTokenClient();
      if (gcalAPI.isLoggedIn()) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userInfo) userInfo.classList.remove('hidden');
        if (userName) userName.textContent = 'Mitarbeiter (Angemeldet)';
        renderer.refresh();
      } else {
        // Token expired or not present. Try silent auto-login.
        try {
          gcalAPI.login(true); // silent = true
        } catch (e) {
          console.warn('Silent login failed on startup:', e);
          gcalAPI.logout();
        }
      }
    } else {
      openModal(settingsModal);
      showToast('Bitte konfiguriere zuerst die Google Client-ID!', 'warning');
    }
  }, 1000);

  // Global click event diagnostics and safety fallback
  window.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn) {
      console.log('Global Click Logger: Button clicked ID =', btn.id);
      if (btn.id === 'settingsBtn') {
        console.log('Fallback settings opener triggered');
        if (settingsModal) {
          settingsModal.classList.remove('hidden');
          settingsModal.style.opacity = '1';
          settingsModal.style.pointerEvents = 'auto';
          showToast('Einstellungen geöffnet', 'info');
        }
      }
    }
  });
}

// Robust start check: runs when DOM is fully parsed and interactive
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
