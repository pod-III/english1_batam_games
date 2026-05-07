/* ============================================
   TEMPLATES.JS - Event Type Definitions & Presets
   KlassKit Schedule Tool
   ============================================ */

const EVENT_TYPES = [
  {
    id: 'class',
    label: 'Class',
    icon: 'book-open',
    defaultColor: '#1ea7fd',
    checklist: [
      'Lesson plan completed',
      'Materials prepared',
      'Attendance sheet ready',
      'Classroom setup checked',
      'Post-class reflection'
    ]
  },
  {
    id: 'meeting',
    label: 'Meeting',
    icon: 'users',
    defaultColor: '#00d063',
    checklist: [
      'Agenda prepared',
      'Meeting notes template ready',
      'Required documents gathered',
      'Follow-up actions listed'
    ]
  },
  {
    id: 'test',
    label: 'Test / Exam',
    icon: 'clipboard-check',
    defaultColor: '#ff4785',
    checklist: [
      'Test papers printed',
      'Answer key prepared',
      'Extra stationery available',
      'Seating arrangement set',
      'Grading rubric finalized'
    ]
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: 'target',
    defaultColor: '#ff7e33',
    checklist: [
      'Activity instructions ready',
      'Materials / props gathered',
      'Groups / teams assigned',
      'Timer / scoring prepared'
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'briefcase',
    defaultColor: '#ff7e33',
    checklist: [
      'Documents submitted',
      'Reports updated',
      'Emails responded to',
      'Filing completed'
    ]
  },
  {
    id: 'break',
    label: 'Break',
    icon: 'coffee',
    defaultColor: '#64748B',
    checklist: []
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'bookmark',
    defaultColor: '#0EA5E9',
    checklist: []
  }
];

const COLOR_PALETTE = [
  { id: 'blue',   hex: '#1ea7fd', label: 'Blue' },
  { id: 'green',  hex: '#00d063', label: 'Green' },
  { id: 'pink',   hex: '#ff4785', label: 'Pink' },
  { id: 'orange', hex: '#ff7e33', label: 'Orange' },
  { id: 'purple', hex: '#ff4785', label: 'Purple' },
  { id: 'teal',   hex: '#14B8A6', label: 'Teal' },
  { id: 'red',    hex: '#EF4444', label: 'Red' },
  { id: 'yellow', hex: '#F59E0B', label: 'Amber' },
  { id: 'slate',  hex: '#64748B', label: 'Slate' },
  { id: 'cyan',   hex: '#0EA5E9', label: 'Cyan' },
];

const RECURRENCE_OPTIONS = [
  { id: 'none',    label: 'Does not repeat' },
  { id: 'daily',   label: 'Every day' },
  { id: 'weekly',  label: 'Every week' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Every month' },
  { id: 'custom-days', label: 'Specific Days' },
];

// Used by Admin Tracker (not displayed in Schedule view)
const LESSON_STATUSES = [
  { id: 'not_ready', label: 'Not Ready', icon: 'x-circle',    color: '#ff4785' },
  { id: 'draft',    label: 'Draft',     icon: 'edit-3',       color: '#94a3b8' },
  { id: 'ready',    label: 'Ready',     icon: 'check-circle', color: '#1ea7fd' },
  { id: 'taught',   label: 'Taught',    icon: 'users',        color: '#00d063' },
  { id: 'reviewed', label: 'Reflected', icon: 'star',         color: '#ff7e33' }
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ============================================
   Helper: Get event type definition by ID
   ============================================ */
function getEventType(typeId) {
  return EVENT_TYPES.find(t => t.id === typeId) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

/* ============================================
   Helper: Get color definition by ID
   ============================================ */
function getColor(colorId) {
  return COLOR_PALETTE.find(c => c.id === colorId) || COLOR_PALETTE[0];
}

/* ============================================
   Helper: Create a new event object
   ============================================ */
function createEventObject({ name, typeId, colorHex, date, startTime, endTime, room, notes, recurrence, recurrenceDays, checklist }) {
  const type = getEventType(typeId);
  const defaultChecklist = checklist || type.checklist.map((text, i) => ({
    id: `chk_${Date.now()}_${i}`,
    text,
    done: false
  }));

  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || type.label,
    typeId: typeId || 'other',
    color: colorHex || type.defaultColor,
    date, // 'YYYY-MM-DD'
    startTime, // 'HH:MM'
    endTime,   // 'HH:MM'
    room: room || '',
    notes: notes || '',
    recurrence: recurrence || 'none',
    checklist: defaultChecklist,
    overrideType: '',
    graduationClass: false,
    graduationDate: '',
    recurrenceDays: recurrenceDays || [], // Array of day indices [0-6]
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/* ============================================
   Time Utilities
   ============================================ */
let SCHEDULE_START_HOUR = 6;  // 06:00
let SCHEDULE_END_HOUR = 22;   // 22:00
const SLOT_MINUTES = 15;
let TOTAL_SLOTS = ((SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) / SLOT_MINUTES;

function updateScheduleRange(start, end) {
  SCHEDULE_START_HOUR = parseInt(start);
  SCHEDULE_END_HOUR = parseInt(end);
  TOTAL_SLOTS = ((SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) / SLOT_MINUTES;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToSlotIndex(timeStr) {
  const totalMinutes = timeToMinutes(timeStr);
  return (totalMinutes - SCHEDULE_START_HOUR * 60) / SLOT_MINUTES;
}

function slotIndexToTime(index) {
  const totalMinutes = SCHEDULE_START_HOUR * 60 + index * SLOT_MINUTES;
  return minutesToTime(totalMinutes);
}

function formatTimeDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

