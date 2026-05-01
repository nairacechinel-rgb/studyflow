// ===== ESTADO GLOBAL =====
let state = {
  tasks: [],
  schedule: [],
  subjects: [],
  flashcards: [],
  goals: [],
  notes: [],
  pomodoroSessions: [],
  settings: {
    userName: 'Naira',
    theme: 'light',
    soundEnabled: true,
    focusTime: 25,
    shortBreak: 5,
    longBreak: 15,
    sessionsBeforeLong: 4
  },
  streak: 0,
  lastStudyDate: null
};

let currentPage = 'dashboard';
let currentWeekOffset = 0;
let selectedColor = '#6C63FF';
let selectedSubjectColor = '#6C63FF';
let activeNoteId = null;
let taskFilter = 'all';
let statsPeriod = 'week';
let currentFlashcardIndex = 0;
let studyDeck = [];
let deferredInstallPrompt = null;

const COLORS = [
  '#6C63FF','#e74c3c','#2ecc71','#f39c12','#3498db',
  '#9b59b6','#1abc9c','#e67e22','#e91e63','#00bcd4',
  '#ff5722','#607d8b','#8bc34a','#ffc107','#795548'
];

const DAYS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const DAYS_SHORT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

// ===== POMODORO STATE =====
let timer = {
  interval: null,
  seconds: 25 * 60,
  totalSeconds: 25 * 60,
  running: false,
  mode: 'pomodoro',
  sessionCount: 0,
  totalFocusSeconds: 0
};

let miniTimer = {
  interval: null,
  seconds: 25 * 60,
  totalSeconds: 25 * 60,
  running: false
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupNavigation();
  setupSidebar();
  setupTheme();
  setupFilterBars();
  initColorPickers();
  updateGreeting();
  updateStreak();
  renderDashboard();
  renderSchedule();
  renderTasks();
  renderSubjects();
  renderFlashcards();
  renderGoals();
  renderStats();
  renderNotes();
  populatePomodoroSubjects();
  setInterval(updateGreeting, 60000);
  registerServiceWorker();
  setupInstallPrompt();
});

// ===== STORAGE =====
function saveData() {
  try {
    localStorage.setItem('studyflow_state', JSON.stringify(state));
  } catch(e) {
    showToast('Erro ao salvar dados');
  }
}

function loadData() {
  try {
    const saved = localStorage.getItem('studyflow_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      state.settings = { ...state.settings, ...(parsed.settings || {}) };
    }
  } catch(e) {
    console.warn('Erro ao carregar dados:', e);
  }
  applySettings();
}

function applySettings() {
  const s = state.settings;
  document.body.setAttribute('data-theme', s.theme || 'light');

  const fields = {
    userName: s.userName,
    themeSelect: s.theme,
    focusTime: s.focusTime,
    shortBreak: s.shortBreak,
    longBreak: s.longBreak,
    sessionsBeforeLong: s.sessionsBeforeLong
  };

  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  });

  const soundEl = document.getElementById('soundEnabled');
  if (soundEl) soundEl.checked = s.soundEnabled !== false;

  timer.seconds = (s.focusTime || 25) * 60;
  timer.totalSeconds = (s.focusTime || 25) * 60;
  updateTimerDisplay();
  updateMiniTimerDisplay();
}

function saveSetting(key, value) {
  state.settings[key] = value;
  saveData();
}

// ===== NAVIGATION =====
function setupNavigation() {
  const navLinks = document.querySelectorAll('[data-page]');
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.getAttribute('data-page');
      navigateTo(page);
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('active');
      }
    });
  });

  const hash = window.location.hash.replace('#', '');
  if (hash) navigateTo(hash);
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('[data-page]').forEach(l => l.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll(`[data-page="${page}"]`).forEach(l => l.classList.add('active'));

  const titles = {
    dashboard:'Dashboard', schedule:'Cronograma', tasks:'Tarefas',
    pomodoro:'Pomodoro', subjects:'Matérias', flashcards:'Flashcards',
    goals:'Metas', stats:'Estatísticas', notes:'Anotações', settings:'Configurações'
  };
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = titles[page] || page;
  currentPage = page;

  const renders = {
    dashboard: renderDashboard,
    schedule: renderSchedule,
    tasks: renderTasks,
    subjects: renderSubjects,
    flashcards: renderFlashcards,
    goals: renderGoals,
    stats: renderStats,
    notes: renderNotes,
    pomodoro: populatePomodoroSubjects
  };
  if (renders[page]) renders[page]();
}

// ===== SIDEBAR =====
function setupSidebar() {
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
  });
  document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

// ===== THEME =====
function setupTheme() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = state.settings.theme || 'light';
    const next = current === 'light' ? 'dark' : current === 'dark' ? 'purple' : 'light';
    setTheme(next);
    const sel = document.getElementById('themeSelect');
    if (sel) sel.value = next;
  });
}

function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  saveSetting('theme', theme);
  const icon = document.querySelector('#themeToggle i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : theme === 'purple' ? 'fas fa-star' : 'fas fa-moon';
  }
}

// ===== GREETING & DATE =====
function updateGreeting() {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const name = state.settings.userName || 'Naira';

  const greetEl = document.getElementById('greetingText');
  if (greetEl) greetEl.textContent = `${greeting}, ${name}!`;

  const avatar = document.getElementById('userAvatar');
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase();

  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('pt-BR', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
  }
}

// ===== STREAK =====
function updateStreak() {
  const today = new Date().toDateString();
  const last = state.lastStudyDate;

  if (last) {
    const lastDate = new Date(last);
    const diff = Math.floor((new Date() - lastDate) / 86400000);
    if (diff === 0) {
      // mesmo dia, mantém
    } else if (diff === 1) {
      state.streak = (state.streak || 0) + 1;
      state.lastStudyDate = today;
    } else {
      state.streak = 0;
      state.lastStudyDate = today;
    }
  } else {
    state.lastStudyDate = today;
    state.streak = 0;
  }

  const el = document.getElementById('streakCount');
  if (el) el.textContent = state.streak || 0;
  saveData();
}

// ===== COLOR PICKERS =====
function initColorPickers() {
  buildColorPicker('schedulePicker', COLORS, c => { selectedColor = c; });
  buildColorPicker('subjectColorPicker', COLORS, c => { selectedSubjectColor = c; });
}

function buildColorPicker(containerId, colors, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  colors.forEach((color, i) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (i === 0 ? ' selected' : '');
    dot.style.background = color;
    dot.addEventListener('click', () => {
      container.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      onSelect(color);
    });
    container.appendChild(dot);
  });
}

function setColorPickerValue(containerId, color, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.color-dot').forEach(dot => {
    dot.classList.remove('selected');
    if (dot.style.background === color || dot.style.backgroundColor === color) {
      dot.classList.add('selected');
    }
  });
  if (onSelect) onSelect(color);
}

// ===== FILTER BARS =====
function setupFilterBars() {
  document.querySelectorAll('#taskFilterBar .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#taskFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      taskFilter = btn.getAttribute('data-filter');
      renderTasks();
    });
  });
}

// ===== MODALS =====
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ===== TOAST =====
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== UTILS =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function getWeekDates(offset = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getCategoryLabel(cat) {
  const map = { study:'📚 Estudo', home:'🏠 Casa', leisure:'🎮 Lazer', health:'💪 Saúde' };
  return map[cat] || cat;
}

function getCategoryClass(cat) {
  return `tag-${cat}`;
}

function getPriorityLabel(p) {
  const map = { high:'🔴 Alta', medium:'🟡 Média', low:'🟢 Baixa' };
  return map[p] || p;
}

// ===== DASHBOARD =====
function renderDashboard() {
  updateDashboardStats();
  renderTodayTasks();
  renderPendingTasksList();
  renderWeekGoalsList();
}

function updateDashboardStats() {
  const today = new Date().toDateString();

  const todayPomodoros = (state.pomodoroSessions || []).filter(s => {
    return new Date(s.date).toDateString() === today && s.mode === 'pomodoro';
  });

  const todayMinutes = todayPomodoros.reduce((acc, s) => acc + (s.duration || 0), 0);
  const doneTasks = (state.tasks || []).filter(t => t.done).length;
  const totalGoals = (state.goals || []).length;
  const doneGoals = (state.goals || []).filter(g => {
    return g.current >= g.target;
  }).length;
  const goalsPercent = totalGoals ? Math.round((doneGoals / totalGoals) * 100) : 0;

  const el = id => document.getElementById(id);
  if (el('todayMinutes')) el('todayMinutes').textContent = todayMinutes;
  if (el('tasksCompleted')) el('tasksCompleted').textContent = doneTasks;
  if (el('pomodorosDone')) el('pomodorosDone').textContent = todayPomodoros.length;
  if (el('goalsProgress')) el('goalsProgress').textContent = goalsPercent + '%';
  if (el('streakCount')) el('streakCount').textContent = state.streak || 0;
}

function renderTodayTasks() {
  const container = document.getElementById('todayTasks');
  if (!container) return;
  const todayIdx = getTodayIndex();
  const items = (state.schedule || []).filter(s => s.day == todayIdx);

  if (!items.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fas fa-calendar-check"></i><p>Nenhuma atividade hoje</p></div>';
    return;
  }

  items.sort((a, b) => a.start.localeCompare(b.start));
  container.innerHTML = items.map(item => `
    <div class="today-item">
      <div class="dot" style="background:${item.color}"></div>
      <span class="time">${item.start}</span>
      <span>${item.title}</span>
    </div>
  `).join('');
}

function renderPendingTasksList() {
  const container = document.getElementById('pendingTasksList');
  if (!container) return;
  const pending = (state.tasks || [])
    .filter(t => !t.done)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] || 1) - (order[b.priority] || 1);
    })
    .slice(0, 5);

  if (!pending.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fas fa-check-double"></i><p>Nenhuma tarefa pendente</p></div>';
    return;
  }

  const colors = { high: '#e74c3c', medium: '#f39c12', low: '#2ecc71' };
  container.innerHTML = pending.map(t => `
    <div class="pending-item">
      <div class="priority-dot" style="background:${colors[t.priority] || '#999'}"></div>
      <span style="flex:1">${t.title}</span>
      <span class="task-tag ${getCategoryClass(t.category)}">${getCategoryLabel(t.category)}</span>
    </div>
  `).join('');
}

function renderWeekGoalsList() {
  const container = document.getElementById('weekGoalsList');
  if (!container) return;
  const weekly = (state.goals || []).filter(g => g.type === 'weekly').slice(0, 4);

  if (!weekly.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fas fa-bullseye"></i><p>Nenhuma meta semanal</p></div>';
    return;
  }

  container.innerHTML = weekly.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    return `
      <div class="week-goal-item">
        <div class="label">
          <span>${g.title}</span>
          <span>${g.current}/${g.target} ${g.unit || ''}</span>
        </div>
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('');
}

// ===== SCHEDULE =====
function renderSchedule() {
  const dates = getWeekDates(currentWeekOffset);
  const todayIdx = getTodayIndex();

  const label = document.getElementById('weekLabel');
  if (label) {
    const start = dates[0].toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    const end = dates[6].toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    label.textContent = `${start} – ${end}`;
  }

  const grid = document.getElementById('scheduleGrid');
  if (!grid) return;

  grid.innerHTML = DAYS.map((day, i) => {
    const date = dates[i];
    const isToday = currentWeekOffset === 0 && i === todayIdx;
    const dayItems = (state.schedule || []).filter(s => {
      if (s.recurrence === 'weekly') return s.day == i;
      if (s.recurrence === 'once') return s.day == i;
      return s.day == i;
    });

    dayItems.sort((a, b) => a.start.localeCompare(b.start));

    return `
      <div class="schedule-day">
        <div class="schedule-day-header ${isToday ? 'today' : ''}">
          ${DAYS_SHORT[i]}
          <small>${date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}</small>
        </div>
        <div class="schedule-items">
          ${dayItems.map(item => `
            <div class="schedule-item"
              style="background:${item.color}22;border-left:3px solid ${item.color};color:${item.color}"
              onclick="editScheduleItem('${item.id}')">
              <div class="item-title">${item.title}</div>
              <div class="item-time">${item.start} – ${item.end}</div>
              <button class="item-delete" onclick="event.stopPropagation();deleteScheduleItem('${item.id}')">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function changeWeek(dir) {
  currentWeekOffset += dir;
  renderSchedule();
}

function openScheduleModal(editId = null) {
  const titleEl = document.getElementById('scheduleModalTitle');
  const editIdEl = document.getElementById('scheduleEditId');

  if (editId) {
    const item = state.schedule.find(s => s.id === editId);
    if (!item) return;
    if (titleEl) titleEl.textContent = 'Editar Atividade';
    if (editIdEl) editIdEl.value = editId;
    setVal('scheduleTitle', item.title);
    setVal('scheduleCategory', item.category);
    setVal('scheduleDay', item.day);
    setVal('scheduleStart', item.start);
    setVal('scheduleEnd', item.end);
    setVal('scheduleRecurrence', item.recurrence || 'weekly');
    selectedColor = item.color || '#6C63FF';
    setColorPickerValue('schedulePicker', item.color, c => { selectedColor = c; });
  } else {
    if (titleEl) titleEl.textContent = 'Adicionar ao Cronograma';
    if (editIdEl) editIdEl.value = '';
    setVal('scheduleTitle', '');
    setVal('scheduleDay', getTodayIndex());
    selectedColor = '#6C63FF';
    buildColorPicker('schedulePicker', COLORS, c => { selectedColor = c; });
  }
  openModal('scheduleModal');
}

function editScheduleItem(id) {
  openScheduleModal(id);
}

function saveScheduleItem() {
  const title = getVal('scheduleTitle').trim();
  if (!title) { showToast('Digite um título'); return; }

  const start = getVal('scheduleStart');
  const end = getVal('scheduleEnd');
  if (start >= end) { showToast('O horário de fim deve ser após o início'); return; }

  const editId = getVal('scheduleEditId');
  const item = {
    id: editId || generateId(),
    title,
    category: getVal('scheduleCategory'),
    day: parseInt(getVal('scheduleDay')),
    start,
    end,
    color: selectedColor,
    recurrence: getVal('scheduleRecurrence')
  };

  if (editId) {
    const idx = state.schedule.findIndex(s => s.id === editId);
    if (idx !== -1) state.schedule[idx] = item;
  } else {
    state.schedule.push(item);
  }

  saveData();
  closeModal('scheduleModal');
  renderSchedule();
  renderDashboard();
  showToast(editId ? 'Atividade atualizada!' : 'Atividade adicionada!');
}

function deleteScheduleItem(id) {
  confirmAction('Remover esta atividade?', () => {
    state.schedule = state.schedule.filter(s => s.id !== id);
    saveData();
    renderSchedule();
    renderDashboard();
    showToast('Atividade removida');
  });
}

// ===== TASKS =====
function renderTasks() {
  const container = document.getElementById('tasksList');
  if (!container) return;

  let tasks = [...(state.tasks || [])];

  if (taskFilter === 'study') tasks = tasks.filter(t => t.category === 'study');
  else if (taskFilter === 'home') tasks = tasks.filter(t => t.category === 'home');
  else if (taskFilter === 'leisure') tasks = tasks.filter(t => t.category === 'leisure');
  else if (taskFilter === 'health') tasks = tasks.filter(t => t.category === 'health');
  else if (taskFilter === 'pending') tasks = tasks.filter(t => !t.done);
  else if (taskFilter === 'done') tasks = tasks.filter(t => t.done);

  tasks.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] || 1) - (order[b.priority] || 1);
  });

  if (!tasks.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px"><i class="fas fa-tasks"></i><p>Nenhuma tarefa encontrada</p></div>';
    return;
  }

  container.innerHTML = tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}">
      <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')">
        ${t.done ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <div class="task-info">
        <div class="task-title">${t.title}</div>
        ${t.desc ? `<div class="task-desc">${t.desc}</div>` : ''}
        <div class="task-meta">
          <span class="task-tag ${getCategoryClass(t.category)}">${getCategoryLabel(t.category)}</span>
          <span class="task-tag priority-${t.priority}">${getPriorityLabel(t.priority)}</span>
          ${t.date ? `<span class="task-date"><i class="fas fa-calendar"></i> ${formatDate(t.date)}</span>` : ''}
          ${t.subject ? `<span class="task-tag" style="background:var(--primary-light);color:var(--primary)">${getSubjectName(t.subject)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-small" onclick="openTaskModal('${t.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn-small danger" onclick="deleteTask('${t.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function openTaskModal(editId = null) {
  populateSubjectSelects();
  const titleEl = document.getElementById('taskModalTitle');
  const editIdEl = document.getElementById('taskEditId');

  if (editId && typeof editId === 'string' && editId.length > 3) {
    const task = state.tasks.find(t => t.id === editId);
    if (!task) return;
    if (titleEl) titleEl.textContent = 'Editar Tarefa';
    if (editIdEl) editIdEl.value = editId;
    setVal('taskTitle', task.title);
    setVal('taskDesc', task.desc || '');
    setVal('taskCategory', task.category);
    setVal('taskPriority', task.priority);
    setVal('taskDate', task.date || '');
    setVal('taskSubject', task.subject || '');
  } else {
    if (titleEl) titleEl.textContent = 'Nova Tarefa';
    if (editIdEl) editIdEl.value = '';
    setVal('taskTitle', '');
    setVal('taskDesc', '');
    setVal('taskCategory', 'study');
    setVal('taskPriority', 'medium');
    setVal('taskDate', '');
    setVal('taskSubject', '');
  }
  openModal('taskModal');
}

function saveTask() {
  const title = getVal('taskTitle').trim();
  if (!title) { showToast('Digite um título para a tarefa'); return; }

  const editId = getVal('taskEditId');
  const task = {
    id: editId || generateId(),
    title,
    desc: getVal('taskDesc').trim(),
    category: getVal('taskCategory'),
    priority: getVal('taskPriority'),
    date: getVal('taskDate'),
    subject: getVal('taskSubject'),
    done: false,
    createdAt: new Date().toISOString()
  };

  if (editId) {
    const idx = state.tasks.findIndex(t => t.id === editId);
    if (idx !== -1) {
      task.done = state.tasks[idx].done;
      state.tasks[idx] = task;
    }
  } else {
    state.tasks.push(task);
  }

  saveData();
  closeModal('taskModal');
  renderTasks();
  renderDashboard();
  showToast(editId ? 'Tarefa atualizada!' : 'Tarefa criada!');
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    saveData();
    renderTasks();
    renderDashboard();
    showToast(task.done ? '✅ Tarefa concluída!' : 'Tarefa reaberta');
  }
}

function deleteTask(id) {
  confirmAction('Remover esta tarefa?', () => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
    renderDashboard();
    showToast('Tarefa removida');
  });
}

// ===== POMODORO =====
function setMode(mode) {
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
  }
  timer.mode = mode;

  const times = {
    pomodoro: state.settings.focusTime * 60,
    short: state.settings.shortBreak * 60,
    long: state.settings.longBreak * 60
  };

  timer.seconds = times[mode] || 25 * 60;
  timer.totalSeconds = timer.seconds;

  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });

  const labels = { pomodoro:'Foco', short:'Pausa Curta', long:'Pausa Longa' };
  const labelEl = document.getElementById('timerLabel');
  if (labelEl) labelEl.textContent = labels[mode] || 'Foco';

  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.innerHTML = '<i class="fas fa-play"></i>';

  updateTimerDisplay();
  updateRing();
}

function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.interval);
    timer.running = false;
    const btn = document.getElementById('startBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
  } else {
    timer.running = true;
    const btn = document.getElementById('startBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    timer.interval = setInterval(() => {
      timer.seconds--;
      if (timer.mode === 'pomodoro') timer.totalFocusSeconds++;
      updateTimerDisplay();
      updateRing();
      if (timer.seconds <= 0) {
        clearInterval(timer.interval);
        timer.running = false;
        onTimerEnd();
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timer.interval);
  timer.running = false;
  const times = {
    pomodoro: state.settings.focusTime * 60,
    short: state.settings.shortBreak * 60,
    long: state.settings.longBreak * 60
  };
  timer.seconds = times[timer.mode] || 25 * 60;
  timer.totalSeconds = timer.seconds;
  updateTimerDisplay();
  updateRing();
  const btn = document.getElementById('startBtn');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
}

function skipTimer() {
  clearInterval(timer.interval);
  timer.running = false;
  onTimerEnd();
}

function onTimerEnd() {
  playSound();
  sendNotification();

  if (timer.mode === 'pomodoro') {
    timer.sessionCount++;
    const subjectEl = document.getElementById('pomodoroSubject');
    const subject = subjectEl ? subjectEl.value : '';
    const duration = Math.round(timer.totalFocusSeconds / 60);

    state.pomodoroSessions.push({
      id: generateId(),
      date: new Date().toISOString(),
      mode: 'pomodoro',
      duration,
      subject
    });

    state.lastStudyDate = new Date().toDateString();
    saveData();
    updateStreak();

    const sessEl = document.getElementById('sessionCount');
    if (sessEl) sessEl.textContent = timer.sessionCount;

    const focusEl = document.getElementById('totalFocusTime');
    if (focusEl) focusEl.textContent = Math.round(timer.totalFocusSeconds / 60) + 'min';

    showToast('🍅 Pomodoro concluído! Hora de descansar.');

    const sessionsBeforeLong = state.settings.sessionsBeforeLong || 4;
    if (timer.sessionCount % sessionsBeforeLong === 0) {
      setMode('long');
    } else {
      setMode('short');
    }
  } else {
    showToast('⏰ Pausa encerrada! Hora de focar.');
    setMode('pomodoro');
  }

  const btn = document.getElementById('startBtn');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
}

function updateTimerDisplay() {
  const el = document.getElementById('timerDisplay');
  if (el) el.textContent = formatTime(timer.seconds);
  document.title = `${formatTime(timer.seconds)} – StudyFlow`;
}

function updateMiniTimerDisplay() {
  const el = document.getElementById('miniTimerDisplay');
  if (el) el.textContent = formatTime(miniTimer.seconds);
}

function updateRing() {
  const ring = document.getElementById('ringProgress');
  if (!ring) return;
  const circumference = 565;
  const progress = timer.seconds / timer.totalSeconds;
  ring.style.strokeDashoffset = circumference * (1 - progress);
}

function updateTimerSettings() {
  state.settings.focusTime = parseInt(getVal('focusTime')) || 25;
  state.settings.shortBreak = parseInt(getVal('shortBreak')) || 5;
  state.settings.longBreak = parseInt(getVal('longBreak')) || 15;
  state.settings.sessionsBeforeLong = parseInt(getVal('sessionsBeforeLong')) || 4;
  saveData();
  if (!timer.running) resetTimer();
}

function populatePomodoroSubjects() {
  const sel = document.getElementById('pomodoroSubject');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecionar matéria...</option>';
  (state.subjects || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.icon} ${s.name}`;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

// ===== MINI POMODORO =====
function miniPomodoroToggle() {
  if (miniTimer.running) {
    clearInterval(miniTimer.interval);
    miniTimer.running = false;
    const btn = document.getElementById('miniStartBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';
  } else {
    miniTimer.running = true;
    const btn = document.getElementById('miniStartBtn');
    if (btn) btn.innerHTML = '<i class="fas fa-pause"></i>';
    miniTimer.interval = setInterval(() => {
      miniTimer.seconds--;
      updateMiniTimerDisplay();
      if (miniTimer.seconds <= 0) {
        clearInterval(miniTimer.interval);
        miniTimer.running = false;
        miniTimer.seconds = (state.settings.focusTime || 25) * 60;
        updateMiniTimerDisplay();
        playSound();
        showToast('🍅 Pomodoro concluído!');
        const btn2 = document.getElementById('miniStartBtn');
        if (btn2) btn2.innerHTML = '<i class="fas fa-play"></i>';
      }
    }, 1000);
  }
}

function miniPomodoroReset() {
  clearInterval(miniTimer.interval);
  miniTimer.running = false;
  miniTimer.seconds = (state.settings.focusTime || 25) * 60;
  updateMiniTimerDisplay();
  const btn = document.getElementById('miniStartBtn');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i>';

  const labelEl = document.getElementById('miniLabel');
  if (labelEl) labelEl.textContent = 'Foco';
}

// ===== SOUND =====
function playSound() {
  if (!state.settings.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

// ===== NOTIFICATIONS =====
function requestNotifications() {
  if ('Notification' in window) {
    Notification.requestPermission().then(perm => {
      showToast(perm === 'granted' ? '🔔 Notificações ativadas!' : 'Permissão negada');
    });
  } else {
    showToast('Navegador não suporta notificações');
  }
}

function sendNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    const messages = {
      pomodoro: 'Pomodoro concluído! Hora de descansar 🎉',
      short: 'Pausa encerrada! Bora focar 💪',
      long: 'Pausa longa encerrada! Continue estudando 📚'
    };
    new Notification('StudyFlow', {
      body: messages[timer.mode] || 'Timer concluído!',
      icon: 'icons/icon-192.png'
    });
  }
}

// ===== SUBJECTS =====
function renderSubjects() {
  const container = document.getElementById('subjectsList');
  if (!container) return;

  if (!state.subjects.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px"><i class="fas fa-book"></i><p>Nenhuma matéria cadastrada</p></div>';
    return;
  }

  container.innerHTML = state.subjects.map(s => {
    const sessions = (state.pomodoroSessions || []).filter(p => p.subject === s.id && p.mode === 'pomodoro');
    const totalMinutes = sessions.reduce((acc, p) => acc + (p.duration || 0), 0);
    const goalMinutes = (s.goalHours || 5) * 60;
    const pct = Math.min(100, Math.round((totalMinutes / goalMinutes) * 100));

    return `
      <div class="subject-card" style="--subject-color:${s.color}">
        <div class="subject-actions">
          <button class="btn-small" onclick="openSubjectModal('${s.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn-small danger" onclick="deleteSubject('${s.id}')"><i class="fas fa-trash"></i></button>
        </div>
        <div class="subject-icon">${s.icon}</div>
        <div class="subject-name">${s.name}</div>
        <div class="subject-hours">${totalMinutes}min / ${goalMinutes}min semanais</div>
        <div class="subject-progress">
          <div class="subject-progress-label">
            <span>Progresso semanal</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%;background:${s.color}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openSubjectModal(editId = null) {
  const titleEl = document.getElementById('subjectModalTitle');
  const editIdEl = document.getElementById('subjectEditId');

  if (editId) {
    const subj = state.subjects.find(s => s.id === editId);
    if (!subj) return;
    if (titleEl) titleEl.textContent = 'Editar Matéria';
    if (editIdEl) editIdEl.value = editId;
    setVal('subjectName', subj.name);
    setVal('subjectIcon', subj.icon);
    setVal('subjectGoalHours', subj.goalHours || 5);
    selectedSubjectColor = subj.color || '#6C63FF';
    buildColorPicker('subjectColorPicker', COLORS, c => { selectedSubjectColor = c; });
    setColorPickerValue('subjectColorPicker', subj.color, c => { selectedSubjectColor = c; });
  } else {
    if (titleEl) titleEl.textContent = 'Nova Matéria';
    if (editIdEl) editIdEl.value = '';
    setVal('subjectName', '');
    setVal('subjectIcon', '📚');
    setVal('subjectGoalHours', 5);
    selectedSubjectColor = '#6C63FF';
    buildColorPicker('subjectColorPicker', COLORS, c => { selectedSubjectColor = c; });
  }
  openModal('subjectModal');
}

function saveSubject() {
  const name = getVal('subjectName').trim();
  if (!name) { showToast('Digite o nome da matéria'); return; }

  const editId = getVal('subjectEditId');
  const subj = {
    id: editId || generateId(),
    name,
    icon: getVal('subjectIcon'),
    color: selectedSubjectColor,
    goalHours: parseInt(getVal('subjectGoalHours')) || 5
  };

  if (editId) {
    const idx = state.subjects.findIndex(s => s.id === editId);
    if (idx !== -1) state.subjects[idx] = subj;
  } else {
    state.subjects.push(subj);
  }

  saveData();
  closeModal('subjectModal');
  renderSubjects();
  populateSubjectSelects();
  populatePomodoroSubjects();
  showToast(editId ? 'Matéria atualizada!' : 'Matéria criada!');
}

function deleteSubject(id) {
  confirmAction('Remover esta matéria?', () => {
    state.subjects = state.subjects.filter(s => s.id !== id);
    saveData();
    renderSubjects();
    populateSubjectSelects();
    showToast('Matéria removida');
  });
}

function populateSubjectSelects() {
  const selects = ['taskSubject', 'flashcardSubject', 'noteSubject', 'flashcardSubjectFilter'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    const isFilter = id === 'flashcardSubjectFilter';
    sel.innerHTML = isFilter
      ? '<option value="">Todas as matérias</option>'
      : '<option value="">Nenhuma</option>';
    (state.subjects || []).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.icon} ${s.name}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

function getSubjectName(id) {
  const s = state.subjects.find(s => s.id === id);
  return s ? `${s.icon} ${s.name}` : '';
}

// ===== FLASHCARDS =====
function renderFlashcards() {
  populateSubjectSelects();
  const filterVal = getVal('flashcardSubjectFilter');
  let cards = [...(state.flashcards || [])];
  if (filterVal) cards = cards.filter(c => c.subject === filterVal);

  const studyArea = document.getElementById('flashcardStudyArea');
  const listEl = document.getElementById('flashcardsList');

  if (studyArea) studyArea.innerHTML = '';

  if (!cards.length) {
    if (listEl) listEl.innerHTML = '<div class="empty-state" style="padding:40px"><i class="fas fa-layer-group"></i><p>Nenhum flashcard encontrado</p></div>';
    return;
  }

  if (listEl) {
    listEl.innerHTML = cards.map(c => {
      const subj = state.subjects.find(s => s.id === c.subject);
      return `
        <div class="fc-list-card">
          <div class="fc-question">${c.front}</div>
          <div class="fc-answer">${c.back}</div>
          ${subj ? `<div style="font-size:.75rem;color:${subj.color};margin-top:6px">${subj.icon} ${subj.name}</div>` : ''}
          <div class="fc-actions">
            <button class="btn-small" onclick="openFlashcardModal('${c.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-small danger" onclick="deleteFlashcard('${c.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function startStudySession() {
  const filterVal = getVal('flashcardSubjectFilter');
  studyDeck = [...(state.flashcards || [])];
  if (filterVal) studyDeck = studyDeck.filter(c => c.subject === filterVal);

  if (!studyDeck.length) {
    showToast('Nenhum flashcard para estudar');
    return;
  }

  studyDeck = studyDeck.sort(() => Math.random() - 0.5);
  currentFlashcardIndex = 0;
  showStudyCard();
}

function showStudyCard() {
  const area = document.getElementById('flashcardStudyArea');
  if (!area) return;

  if (currentFlashcardIndex >= studyDeck.length) {
    area.innerHTML = `
      <div class="flashcard-study-mode">
        <div style="font-size:2rem">🎉</div>
        <h3>Sessão concluída!</h3>
        <p style="color:var(--text2)">Você revisou ${studyDeck.length} flashcard(s)</p>
        <button class="btn-primary" onclick="startStudySession()">Recomeçar</button>
        <button class="btn-secondary" onclick="document.getElementById('flashcardStudyArea').innerHTML=''">Fechar</button>
      </div>
    `;
    return;
  }

  const card = studyDeck[currentFlashcardIndex];
  area.innerHTML = `
    <div class="flashcard-study-mode">
      <div class="study-progress">${currentFlashcardIndex + 1} / ${studyDeck.length}</div>
      <div class="fc-card-wrap" id="studyCard" onclick="flipStudyCard()">
        <div class="fc-inner">
          <div class="fc-front">${card.front}</div>
          <div class="fc-back">${card.back}</div>
        </div>
      </div>
      <p class="fc-hint">Clique no card para ver a resposta</p>
      <div class="flashcard-rating" id="ratingBtns" style="display:none">
        <button class="rating-btn easy" onclick="rateCard('easy')">😊 Fácil</button>
        <button class="rating-btn medium" onclick="rateCard('medium')">🤔 Médio</button>
        <button class="rating-btn hard" onclick="rateCard('hard')">😰 Difícil</button>
      </div>
    </div>
  `;
}

function flipStudyCard() {
  const card = document.getElementById('studyCard');
  if (card) {
    card.classList.toggle('flipped');
    const rating = document.getElementById('ratingBtns');
    if (rating) rating.style.display = 'flex';
    const hint = document.querySelector('.fc-hint');
    if (hint) hint.textContent = 'Como foi?';
  }
}

function rateCard(rating) {
  currentFlashcardIndex++;
  showStudyCard();
}

function openFlashcardModal(editId = null) {
  populateSubjectSelects();
  const sel = document.getElementById('flashcardSubject');
  if (sel && !sel.querySelector('option[value=""]')) {
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'Selecionar matéria...';
    sel.insertBefore(def, sel.firstChild);
  }

  const titleEl = document.getElementById('flashcardModalTitle');
  const editIdEl = document.getElementById('flashcardEditId');

  if (editId) {
    const card = state.flashcards.find(c => c.id === editId);
    if (!card) return;
    if (titleEl) titleEl.textContent = 'Editar Flashcard';
    if (editIdEl) editIdEl.value = editId;
    setVal('flashcardSubject', card.subject || '');
    setVal('flashcardFront', card.front);
    setVal('flashcardBack', card.back);
  } else {
    if (titleEl) titleEl.textContent = 'Novo Flashcard';
    if (editIdEl) editIdEl.value = '';
    setVal('flashcardFront', '');
    setVal('flashcardBack', '');
  }
  openModal('flashcardModal');
}

function saveFlashcard() {
  const front = getVal('flashcardFront').trim();
  const back = getVal('flashcardBack').trim();
  if (!front || !back) { showToast('Preencha frente e verso do card'); return; }

  const editId = getVal('flashcardEditId');
  const card = {
    id: editId || generateId(),
    front,
    back,
    subject: getVal('flashcardSubject'),
    createdAt: new Date().toISOString()
  };

  if (editId) {
    const idx = state.flashcards.findIndex(c => c.id === editId);
    if (idx !== -1) state.flashcards[idx] = card;
  } else {
    state.flashcards.push(card);
  }

  saveData();
  closeModal('flashcardModal');
  renderFlashcards();
  showToast(editId ? 'Flashcard atualizado!' : 'Flashcard criado!');
}

function deleteFlashcard(id) {
  confirmAction('Remover este flashcard?', () => {
    state.flashcards = state.flashcards.filter(c => c.id !== id);
    saveData();
    renderFlashcards();
    showToast('Flashcard removido');
  });
}

// ===== GOALS =====
function renderGoals() {
  const container = document.getElementById('goalsList');
  if (!container) return;

  if (!state.goals.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px"><i class="fas fa-bullseye"></i><p>Nenhuma meta cadastrada</p></div>';
    return;
  }

  const typeLabels = { daily:'Diária', weekly:'Semanal', monthly:'Mensal', custom:'Personalizada' };

  container.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const color = pct >= 100 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#6C63FF';

    return `
      <div class="goal-item">
        <div class="goal-header">
          <div class="goal-title-wrap">
            <div class="goal-title">
              ${g.title}
              <span class="goal-type-badge">${typeLabels[g.type] || g.type}</span>
            </div>
            ${g.deadline ? `<div class="goal-deadline">📅 Prazo: ${formatDate(g.deadline)}</div>` : ''}
          </div>
          <div class="task-actions">
            <button class="btn-small" onclick="openGoalModal('${g.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-small danger" onclick="deleteGoal('${g.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="goal-bar-wrap">
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="goal-percent" style="color:${color}">${pct}%</div>
        </div>
        <div class="goal-values">${g.current} / ${g.target} ${g.unit || ''}</div>
        <div class="goal-actions">
          <div class="goal-update-wrap">
            <input type="number" id="goalUpdate_${g.id}" placeholder="Adicionar..." min="0"/>
            <button class="btn-small" onclick="updateGoalProgress('${g.id}')">+ Atualizar</button>
          </div>
          ${pct >= 100 ? '<span style="color:#2ecc71;font-weight:600">✅ Concluída!</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function openGoalModal(editId = null) {
  const titleEl = document.getElementById('goalModalTitle');
  const editIdEl = document.getElementById('goalEditId');

  if (editId) {
    const goal = state.goals.find(g => g.id === editId);
    if (!goal) return;
    if (titleEl) titleEl.textContent = 'Editar Meta';
    if (editIdEl) editIdEl.value = editId;
    setVal('goalTitle', goal.title);
    setVal('goalType', goal.type);
    setVal('goalCurrent', goal.current);
    setVal('goalTarget', goal.target);
    setVal('goalUnit', goal.unit || '');
    setVal('goalDeadline', goal.deadline || '');
  } else {
    if (titleEl) titleEl.textContent = 'Nova Meta';
    if (editIdEl) editIdEl.value = '';
    setVal('goalTitle', '');
    setVal('goalType', 'weekly');
    setVal('goalCurrent', 0);
    setVal('goalTarget', 100);
    setVal('goalUnit', '');
    setVal('goalDeadline', '');
  }
  openModal('goalModal');
}

function saveGoal() {
  const title = getVal('goalTitle').trim();
  if (!title) { showToast('Digite um título para a meta'); return; }
  const target = parseFloat(getVal('goalTarget'));
  if (!target || target <= 0) { showToast('A meta precisa ser maior que zero'); return; }

  const editId = getVal('goalEditId');
  const goal = {
    id: editId || generateId(),
    title,
    type: getVal('goalType'),
    current: parseFloat(getVal('goalCurrent')) || 0,
    target,
    unit: getVal('goalUnit').trim(),
    deadline: getVal('goalDeadline'),
    createdAt: new Date().toISOString()
  };

  if (editId) {
    const idx = state.goals.findIndex(g => g.id === editId);
    if (idx !== -1) state.goals[idx] = goal;
  } else {
    state.goals.push(goal);
  }

  saveData();
  closeModal('goalModal');
  renderGoals();
  renderDashboard();
  showToast(editId ? 'Meta atualizada!' : 'Meta criada!');
}

function updateGoalProgress(id) {
  const input = document.getElementById(`goalUpdate_${id}`);
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val === 0) { showToast('Digite um valor válido'); return; }

  const goal = state.goals.find(g => g.id === id);
  if (goal) {
    goal.current = Math.max(0, goal.current + val);
    saveData();
    renderGoals();
    renderDashboard();
    if (goal.current >= goal.target) showToast('🎉 Meta concluída!');
    else showToast('Progresso atualizado!');
  }
}

function deleteGoal(id) {
  confirmAction('Remover esta meta?', () => {
    state.goals = state.goals.filter(g => g.id !== id);
    saveData();
    renderGoals();
    renderDashboard();
    showToast('Meta removida');
  });
}

// ===== STATS =====
function setStatsPeriod(period, btn) {
  statsPeriod = period;
  document.querySelectorAll('.stats-period .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStats();
}

function renderStats() {
  renderSubjectChart();
  renderPomodoroChart();
  renderHistoryChart();
}

function renderSubjectChart() {
  const container = document.getElementById('subjectChart');
  if (!container) return;

  const days = statsPeriod === 'week' ? 7 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const sessions = (state.pomodoroSessions || []).filter(s =>
    s.mode === 'pomodoro' && new Date(s.date) >= since
  );

  if (!sessions.length || !state.subjects.length) {
    container.innerHTML = '<div class="bar-empty">Nenhum dado disponível</div>';
    return;
  }

  const subjectMinutes = {};
  sessions.forEach(s => {
    if (s.subject) {
      subjectMinutes[s.subject] = (subjectMinutes[s.subject] || 0) + (s.duration || 0);
    }
  });

  const max = Math.max(...Object.values(subjectMinutes), 1);

  container.innerHTML = state.subjects.map(subj => {
    const mins = subjectMinutes[subj.id] || 0;
    const pct = Math.round((mins / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label">${subj.icon} ${subj.name}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${subj.color}">
            ${mins > 5 ? `<span>${mins}min</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="bar-empty">Nenhum dado disponível</div>';
}

function renderPomodoroChart() {
  const container = document.getElementById('pomodoroChart');
  if (!container) return;
  // ===== STATS - POMODORO CHART =====
function renderPomodoroChart() {
  const container = document.getElementById('pomodoroChart');
  if (!container) return;

  const days = statsPeriod === 'week' ? 7 : 30;
  const labels = [];
  const counts = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    labels.push(d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }));
    const count = (state.pomodoroSessions || []).filter(s =>
      new Date(s.date).toDateString() === dateStr && s.mode === 'pomodoro'
    ).length;
    counts.push(count);
  }

  const max = Math.max(...counts, 1);

  if (counts.every(c => c === 0)) {
    container.innerHTML = '<div class="bar-empty">Nenhum pomodoro registrado</div>';
    return;
  }

  container.innerHTML = counts.map((count, i) => `
    <div class="bar-row">
      <div class="bar-label">${labels[i]}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((count / max) * 100)}%">
          ${count > 0 ? `<span>${count}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ===== STATS - HISTORY CHART =====
function renderHistoryChart() {
  const container = document.getElementById('historyChart');
  if (!container) return;

  const days = 30;
  const bars = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const sessions = (state.pomodoroSessions || []).filter(s =>
      new Date(s.date).toDateString() === dateStr && s.mode === 'pomodoro'
    );
    const minutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    bars.push({
      date: d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      minutes
    });
  }

  const max = Math.max(...bars.map(b => b.minutes), 1);

  container.innerHTML = `
    <div class="history-chart-wrap">
      ${bars.map(b => {
        const h = Math.max(4, Math.round((b.minutes / max) * 76));
        return `
          <div class="h-bar" style="height:${h}px;opacity:${b.minutes > 0 ? 0.85 : 0.2}">
            <div class="h-tooltip">${b.date}: ${b.minutes}min</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ===== NOTES =====
function renderNotes() {
  populateSubjectSelects();
  const sidebar = document.getElementById('notesSidebar');
  if (!sidebar) return;

  if (!state.notes.length) {
    sidebar.innerHTML = '<div class="empty-state" style="padding:20px"><i class="fas fa-sticky-note"></i><p>Nenhuma anotação</p></div>';
    return;
  }

  sidebar.innerHTML = state.notes.map(n => {
    const subj = n.subject ? state.subjects.find(s => s.id === n.subject) : null;
    const date = new Date(n.updatedAt || n.createdAt).toLocaleDateString('pt-BR');
    return `
      <div class="note-sidebar-item ${activeNoteId === n.id ? 'active' : ''}" onclick="openNote('${n.id}')">
        <h4>${escapeHtml(n.title)}</h4>
        <small>${subj ? subj.icon + ' ' + subj.name + ' · ' : ''}${date}</small>
      </div>
    `;
  }).join('');

  if (activeNoteId) {
    const note = state.notes.find(n => n.id === activeNoteId);
    if (note) renderNoteEditor(note);
  }
}

function openNote(id) {
  activeNoteId = id;
  const note = state.notes.find(n => n.id === id);
  if (note) {
    renderNoteEditor(note);
    renderNotes();
  }
}

function renderNoteEditor(note) {
  const editor = document.getElementById('notesEditor');
  if (!editor) return;

  const subj = note.subject ? state.subjects.find(s => s.id === note.subject) : null;

  editor.innerHTML = `
    <div class="editor-header">
      <input
        class="editor-title-input"
        value="${escapeHtml(note.title)}"
        onchange="updateNoteTitle('${note.id}', this.value)"
        placeholder="Título da anotação"
      />
      <div style="display:flex;gap:8px;align-items:center">
        ${subj ? `<span style="color:${subj.color};font-size:.85rem">${subj.icon} ${subj.name}</span>` : ''}
        <button class="btn-small danger" onclick="deleteNote('${note.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
    <div class="editor-body">
      <textarea
        class="editor-content"
        placeholder="Comece a escrever sua anotação aqui..."
        oninput="updateNoteContent('${note.id}', this.value)"
      >${escapeHtml(note.content || '')}</textarea>
    </div>
  `;
}

function openNoteModal() {
  populateSubjectSelects();
  setVal('noteTitle', '');
  setVal('noteSubject', '');
  openModal('noteModal');
}

function saveNote() {
  const title = getVal('noteTitle').trim();
  if (!title) { showToast('Digite um título para a anotação'); return; }

  const note = {
    id: generateId(),
    title,
    subject: getVal('noteSubject'),
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.notes.unshift(note);
  activeNoteId = note.id;
  saveData();
  closeModal('noteModal');
  renderNotes();
  showToast('Anotação criada!');
}

function updateNoteTitle(id, value) {
  const note = state.notes.find(n => n.id === id);
  if (note) {
    note.title = value;
    note.updatedAt = new Date().toISOString();
    saveData();
    renderNotes();
  }
}

function updateNoteContent(id, value) {
  const note = state.notes.find(n => n.id === id);
  if (note) {
    note.content = value;
    note.updatedAt = new Date().toISOString();
    saveData();
  }
}

function deleteNote(id) {
  confirmAction('Remover esta anotação?', () => {
    state.notes = state.notes.filter(n => n.id !== id);
    if (activeNoteId === id) {
      activeNoteId = null;
      const editor = document.getElementById('notesEditor');
      if (editor) {
        editor.innerHTML = '<div class="empty-state"><i class="fas fa-sticky-note"></i><p>Selecione ou crie uma anotação</p></div>';
      }
    }
    saveData();
    renderNotes();
    showToast('Anotação removida');
  });
}

// ===== CONFIRM =====
function confirmAction(message, callback) {
  const msgEl = document.getElementById('confirmMessage');
  const btnEl = document.getElementById('confirmBtn');
  if (msgEl) msgEl.textContent = message;
  if (btnEl) {
    btnEl.onclick = () => {
      closeModal('confirmModal');
      callback();
    };
  }
  openModal('confirmModal');
}

function confirmClearData() {
  confirmAction('Apagar TODOS os dados? Esta ação não pode ser desfeita!', clearAllData);
}

// ===== DATA EXPORT / IMPORT =====
function exportData() {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyflow_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dados exportados com sucesso!');
  } catch(e) {
    showToast('Erro ao exportar dados');
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      confirmAction('Importar dados? Os dados atuais serão substituídos.', () => {
        state = { ...state, ...parsed };
        saveData();
        applySettings();
        renderDashboard();
        renderSchedule();
        renderTasks();
        renderSubjects();
        renderFlashcards();
        renderGoals();
        renderStats();
        renderNotes();
        showToast('Dados importados com sucesso!');
      });
    } catch(e) {
      showToast('Arquivo inválido');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  localStorage.removeItem('studyflow_state');
  state = {
    tasks: [],
    schedule: [],
    subjects: [],
    flashcards: [],
    goals: [],
    notes: [],
    pomodoroSessions: [],
    settings: {
      userName: 'Naira',
      theme: 'light',
      soundEnabled: true,
      focusTime: 25,
      shortBreak: 5,
      longBreak: 15,
      sessionsBeforeLong: 4
    },
    streak: 0,
    lastStudyDate: null
  };
  applySettings();
  renderDashboard();
  renderSchedule();
  renderTasks();
  renderSubjects();
  renderFlashcards();
  renderGoals();
  renderStats();
  renderNotes();
  showToast('Todos os dados foram apagados');
}

// ===== PWA =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker registrado'))
      .catch(e => console.warn('SW erro:', e));
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installBtn');
    const status = document.getElementById('installStatus');
    if (btn) btn.style.display = 'inline-flex';
    if (status) status.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    showToast('App instalado com sucesso!');
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  });
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(result => {
      if (result.outcome === 'accepted') {
        showToast('Instalando o app...');
      }
      deferredInstallPrompt = null;
    });
  }
}

// ===== HELPERS =====
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}



