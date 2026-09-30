import './OpeningHours.css';

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

// "13:00–21:00, 18:00–22:00" -> [{ start: 780, end: 1260 }, ...] en minutos
function parseRanges(value) {
  const ranges = [];
  const regex = /(\d{1,2}):(\d{2})\s*[–\-a]+\s*(\d{1,2}):(\d{2})/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    const start = Number(match[1]) * 60 + Number(match[2]);
    let end = Number(match[3]) * 60 + Number(match[4]);
    if (end <= start) end += 24 * 60; // cierra después de medianoche
    ranges.push({ start, end });
  }
  return ranges;
}

function parseOpeningHours(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const schedule = {};
  raw.split('|').forEach((part) => {
    const match = part.match(/^\s*([^:]+?)\s*:\s*(.+)$/);
    if (!match) return;
    const dayIndex = DAYS.indexOf(normalize(match[1]));
    if (dayIndex === -1) return;
    const text = match[2].trim();
    schedule[dayIndex] = {
      text: /cerrado|closed/i.test(text) ? 'Cerrado' : text.replace(/\s*[–-]\s*/g, ' – '),
      ranges: parseRanges(text),
    };
  });

  return Object.keys(schedule).length > 0 ? schedule : null;
}

function getStatus(schedule) {
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7; // getDay: 0 = domingo -> lo pasamos a 6
  const minutes = now.getHours() * 60 + now.getMinutes();
  const today = schedule[todayIndex];

  if (!today || today.ranges.length === 0) {
    return { todayIndex, open: false, label: 'Cerrado hoy' };
  }

  const current = today.ranges.find((r) => minutes >= r.start && minutes < r.end);
  if (current) {
    const closeAt = current.end % (24 * 60);
    const hh = String(Math.floor(closeAt / 60)).padStart(2, '0');
    const mm = String(closeAt % 60).padStart(2, '0');
    return { todayIndex, open: true, label: `Abierto · cierra a las ${hh}:${mm}` };
  }

  const next = today.ranges.find((r) => minutes < r.start);
  if (next) {
    const hh = String(Math.floor(next.start / 60)).padStart(2, '0');
    const mm = String(next.start % 60).padStart(2, '0');
    return { todayIndex, open: false, label: `Cerrado · abre a las ${hh}:${mm}` };
  }

  return { todayIndex, open: false, label: 'Cerrado por hoy' };
}

export default function OpeningHours({ value }) {
  const schedule = parseOpeningHours(value);

  if (!schedule) {
    return (
      <div className="opening-hours">
        <h4 className="opening-hours-title">Horario</h4>
        <p className="opening-hours-raw">{value || 'Horario no disponible'}</p>
      </div>
    );
  }

  const status = getStatus(schedule);

  return (
    <div className="opening-hours">
      <div className="opening-hours-header">
        <h4 className="opening-hours-title">Horario</h4>
        <span className={`opening-hours-status ${status.open ? 'is-open' : 'is-closed'}`}>
          <span className="opening-hours-dot" />
          {status.label}
        </span>
      </div>

      <ul className="opening-hours-list">
        {DAY_LABELS.map((label, i) => {
          const day = schedule[i];
          const isToday = i === status.todayIndex;
          return (
            <li key={label} className={`opening-hours-row ${isToday ? 'is-today' : ''}`}>
              <span className="opening-hours-day">
                {label}
                {isToday && <span className="opening-hours-today-tag">Hoy</span>}
              </span>
              <span className={`opening-hours-time ${day?.text === 'Cerrado' || !day ? 'is-closed-day' : ''}`}>
                {day ? day.text : 'Sin información'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}