const afspraakBtn = document.querySelector('.afspraakBtn');
const afspraakForm = document.querySelector('.afspraakForm');
afspraakBtn.addEventListener('click', () => {
  afspraakForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
});


const availChartTxt1 = document.querySelector('.availChartTxt1');
const now = new Date();


// Calculate first (Monday) and last (Sunday) day of the current week
const dayOfWeek = now.getDay();
const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
const firstDay = new Date(now);
firstDay.setHours(0, 0, 0, 0);
firstDay.setDate(now.getDate() + diffToMonday);

const lastDay = new Date(firstDay);
lastDay.setDate(firstDay.getDate() + 6);

function formatDate(date) {
    return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
availChartTxt1.textContent = `Beschikbaarheid deze week: ${formatDate(firstDay)} t/m ${formatDate(lastDay)}`;

const calendar = document.getElementById("calendar");
const days = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
// --- this is the correct Slot Definitions ---
const weekdaySlots = [
  { startTime: '15:00', endTime: '16:30' },
  { startTime: '16:30', endTime: '17:45' }
];
const weekendSlots = [
  { startTime: '10:30', endTime: '12:00' },
  { startTime: '12:00', endTime: '13:30' },
  { startTime: '13:30', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:30' },
  { startTime: '16:30', endTime: '17:45' }
];

// Combine all unique start times for calendar grid rows
const allTimes = [...new Set([
    ...weekdaySlots.map(s => s.startTime),
    ...weekendSlots.map(s => s.startTime)
])].sort();
// --- End New Slot Definitions ---

let bookedAppointmentSlots = {}; // Only holds customer appointments
let adminBlockedSlots = {}; // Only holds admin-blocked slots

// Build calendar grid
function buildCalendar() {
    calendar.innerHTML = ''; // Clear previous calendar
    calendar.appendChild(document.createElement("div")); // empty corner

    const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0, Sunday = 6

    days.forEach((day, index) => {
        const header = document.createElement("div");
        header.className = "time";
        if (index === todayIndex) {
            header.innerHTML = `<strong style="font-size: 22px; color: #ffffff;">${day}</strong>`;
        } else {
            header.textContent = day;
        }
        calendar.appendChild(header);
    });
    allTimes.forEach(time => {
        const timeDiv = document.createElement("div");
        timeDiv.className = "time";
        timeDiv.textContent = time;
        calendar.appendChild(timeDiv);

        for (let i = 0; i < 7; i++) {
            const day = days[i];
            const isWeekend = i >= 5; // 5 = Za, 6 = Zo
            const daySlots = isWeekend ? weekendSlots : weekdaySlots;
            const slotInfo = daySlots.find(s => s.startTime === time);

            if (!slotInfo) {
                // This time doesn't exist for this day, render an empty/disabled slot
                const emptySlot = document.createElement("div");
                emptySlot.className = "slot booked"; // Visually looks unavailable (transparent)
                emptySlot.textContent = "———";
                calendar.appendChild(emptySlot);
                continue;
            }

            const key = `${day}-${time}`;
            // --- Check if the slot is in the past ---
            const slotStartDate = new Date(firstDay);
            slotStartDate.setDate(firstDay.getDate() + i);
            const [startHour, startMinute] = slotInfo.startTime.split(':').map(Number);
            slotStartDate.setHours(startHour, startMinute, 0, 0); // Set to the exact start time
            const isPast = slotStartDate < now; // Use the global 'now' for consistency
            // --- End check ---

            const slot = document.createElement('div');
            if (bookedAppointmentSlots[key]) {
                slot.className = "slot booked";
                slot.textContent = "Bezet";
            } else if (adminBlockedSlots[key]) {
                slot.className = "slot booked"; // Same style as booked
                slot.textContent = "———";
            } else if (isPast) {
                slot.className = "slot past";
                slot.textContent = "Voorbij";
            } else {
                slot.className = "slot";
                slot.textContent = "Vrij";
            }
            calendar.appendChild(slot);
        }
    });
}

// --- Calendar Info Popup Logic ---
const infoBtn = document.querySelector('.infoAboutCalendar');
const infoPopup = document.querySelector('.calendar-info-popup');
const infoPopupCloseBtn = document.querySelector('.calendar-info-close-btn');

if (infoBtn && infoPopup && infoPopupCloseBtn) {
  infoBtn.addEventListener('click', () => {
    const contentDiv = infoPopup.querySelector('.popupTxt22');
    contentDiv.innerHTML = `
      <p class="popup-intro-text">
        De kalender toont de actuele beschikbaarheid. De tijden aan de linkerkant geven de <strong>starttijd</strong> van een afspraak aan. Uw behandeling duurt maximaal tot de start van het volgende blok of (afspraak tijd).
      </p>
      <div class="popup-legend">
        <p><strong>Vrij (Groen):</strong> Dit tijdslot is beschikbaar. Selecteer dit moment in het formulier hieronder om uw afspraak te plannen.</p>
        <p><strong>Bezet (Grijs):</strong> Dit tijdslot is al gereserveerd door een andere klant.</p>
        <p><strong>Voorbij (Transparant groen):</strong> Dit tijdslot ligt in het verleden en kan niet meer worden geboekt.</p>
        <p><strong>——— (Niet beschikbaar):</strong> Op deze tijden is de kapper niet werkzaam en kunnen er geen afspraken worden gemaakt.</p>
      </div>
      <br>
      <p class="popup-form-info">
      In het formulier hieronder kunt u een afspraak maken <br> de onboekbare tijden zijn al automatisch onkiezbaar in het formulier.
      </p>
      <p class="popup-tip">
        <strong>*Tip:</strong> De kalender wordt live bijgewerkt. Maar er kunnen soms kleine vertragingen zijn, dus vernieuw de pagina om de nieuwste beschikbaarheid te zien.
      </p>
    `;
    infoPopup.style.display = 'flex';
    document.body.style.overflowY = 'hidden';
  });

  infoPopupCloseBtn.addEventListener('click', () => {
    infoPopup.style.display = 'none';
    document.body.style.overflowY = 'scroll';
  });

  infoPopup.addEventListener('click', (e) => {
    if (e.target === infoPopup) { // Click on the background
      infoPopup.style.display = 'none';
      document.body.style.overflowY = 'scroll';
    }
  });
}
// ---------- Real-time + initial load integration ----------

const BACKEND_BASE = 'http://localhost:4000'; // change when deployed
const API_APPOINTMENTS = BACKEND_BASE + '/api/appointments';

// connect socket.io
const socket = io(BACKEND_BASE);

// convert appointment to frontend key: dayAbbr-time (e.g., "Di-17:00")
function appointmentToKey(appt) {
  // appt.date is YYYY-MM-DD, convert to day abbreviation using firstDay
  const date = new Date(appt.date + 'T00:00:00');
  const dayIndex = Math.floor((date - firstDay) / (1000 * 60 * 60 * 24)); // 0..6
  const dayAbbr = ['Ma','Di','Wo','Do','Vr','Za','Zo'][dayIndex];
  return `${dayAbbr}-${appt.time}`;
}

// convert blocked slot to frontend key
function blockedSlotToKey(slot) {
  const date = new Date(slot.date + 'T00:00:00');
  const dayIndex = Math.floor((date - firstDay) / (1000 * 60 * 60 * 24));
  if (dayIndex < 0 || dayIndex > 6) return null; // Not in the current week
  const dayAbbr = ['Ma','Di','Wo','Do','Vr','Za','Zo'][dayIndex];
  return `${dayAbbr}-${slot.time}`;
}

// Fetch initial appointments from backend
async function loadAppointmentsFromServer() {
  try {
    const res = await fetch(API_APPOINTMENTS);
    const json = await res.json();
    if (json.success) {
      bookedAppointmentSlots = {}; // Clear old data
      adminBlockedSlots = {}; // Clear old data
      // Process appointments
      json.appointments.forEach(appt => {
        const key = appointmentToKey(appt);
        if (key) bookedAppointmentSlots[key] = true;
      });
      // Process blocked slots
      json.blockedSlots.forEach(slot => {
        const key = blockedSlotToKey(slot);
        if (key) adminBlockedSlots[key] = true;
      });
      buildCalendar();
      populateDateSelect();
    } else {
      console.warn('Could not fetch availability:', json);
    }
  } catch (err) {
    console.error('Failed to load appointments', err);
  }
}

// When a new appointment is created on the server, the server emits 'appointment_created'
socket.on('appointment_created', () => loadAppointmentsFromServer());

// When an admin blocks/unblocks a slot
socket.on('slot_updated', () => loadAppointmentsFromServer());

// When the week resets on the server
socket.on('weekly_reset', () => {
  bookedAppointmentSlots = {};
  adminBlockedSlots = {};
  buildCalendar();
  populateDateSelect();
});

// Call once at load
document.addEventListener('DOMContentLoaded', () => {
  loadAppointmentsFromServer();
});

// Popup logic
function scrollToSection() {
  const popupContainer = document.querySelector('.confirmationPopupC');
  popupContainer.style.display = 'flex';
  popupContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function scrollToSection2() {
  const calendar = document.getElementById('calendar');
  calendar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const popupC = document.querySelector('.confirmationPopupC');
const form = document.querySelector('.afspraakForm');
const [dateSelect, timeSelect] = [document.querySelector('.i3'), document.querySelector('.i4')];
const [i1, i2, i5, i6] = document.querySelectorAll('.i1, .i2, .i5, .i6');
const popupTxt2 = document.querySelector('.popupTxt2');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Validate international phone number: + followed by 8-15 digits
    const phonePattern = /^\+\d{8,15}$/;
    if (!phonePattern.test(i2.value)) {
      alert('Voer een geldig internationaal telefoonnummer in, beginnend met + (bijv. +31612345678).');
      i2.focus();
      return;
    }

    const formData = {
        fullName: i1.value,
        phoneNumber: i2.value,
        date: dateSelect.options[dateSelect.selectedIndex].text,
        exactTime: timeSelect.value,
        treatment: i5.value,
        extraInfo: i6.value
    };

    scrollToSection();
    document.body.style.overflowY = "hidden";

    if (popupTxt2) {
      popupTxt2.innerHTML = `
        <table class="popupTable">
          <tr><td class="popupLabel">Naam:</td><td class="popupValue">${formData.fullName}</td></tr>
          <tr><td class="popupLabel">Tel:</td><td class="popupValue">${formData.phoneNumber}</td></tr>
          <tr><td class="popupLabel">Datum:</td><td class="popupValue">${formData.date}</td></tr>
          <tr><td class="popupLabel">Tijd:</td><td class="popupValue">${formData.exactTime}</td></tr>
          <tr><td class="popupLabel">Behandeling:</td><td class="popupValue">${formData.treatment}</td></tr>
          <tr><td class="popupLabel">Extra:</td><td class="popupValue">${formData.extraInfo ? formData.extraInfo : '-'}</td></tr>
        </table>
        <div class="popupConfirm" style="margin-top:18px;">
          Controleer uw gegevens. Klik op <strong>Bevestigen</strong> om uw afspraak te maken.
        </div>
      `;
    }
  });
}

const annuleren = document.querySelector('.popupBtn1');
const doorgaan = document.querySelector('.popupBtn2');

if (annuleren) {
  annuleren.addEventListener('click', () => {
    popupC.style.display = "none";
    document.body.style.overflowY = "scroll";
  });
}

// --- Dynamic form select options ---
function getAvailableSlots() {
  const available = {};
  const now = new Date();

  days.forEach((day, dayIndex) => {
    const isWeekend = dayIndex >= 5;
    const daySlots = isWeekend ? weekendSlots : weekdaySlots;

    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + dayIndex);

    const availableDaySlots = daySlots.filter(slot => {
      // Check if booked
      const key = `${day}-${slot.startTime}`;
      if (bookedAppointmentSlots[key] || adminBlockedSlots[key]) return false;

      // Check if in the past
      const slotStartDate = new Date(date);
      const [startHour, startMinute] = slot.startTime.split(':').map(Number);
      slotStartDate.setHours(startHour, startMinute, 0, 0);
      if (slotStartDate < now) return false;

      return true;
    });

    if (availableDaySlots.length > 0) {
        const displayDate = formatDate(date);
        const machineDate = date.getFullYear() + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
        available[day] = {
            displayDate: displayDate,
            machineDate: machineDate,
            slots: availableDaySlots // Changed from 'times' to 'slots'
        };
    }
  });
  return available;
}

function populateDateSelect() {
  const availableSlots = getAvailableSlots();
  dateSelect.innerHTML = '<option value="" disabled selected>Kies een datum</option>';
  for (const dayAbbr in availableSlots) {
    const option = document.createElement('option');
    option.value = dayAbbr;
    option.textContent = `${dayAbbr} - ${availableSlots[dayAbbr].displayDate}`;
    // *** IMPORTANT FIX: Add a data attribute with the machine-readable date ***
    option.dataset.fullDate = availableSlots[dayAbbr].machineDate;
    dateSelect.appendChild(option);
  }
  populateTimeSelect(dateSelect.value);
}

function populateTimeSelect(dayAbbr) {
  const availableSlots = getAvailableSlots();
  timeSelect.innerHTML = '<option value="" disabled selected>Kies een tijd</option>';

  if (dayAbbr && availableSlots[dayAbbr]) {
    availableSlots[dayAbbr].slots.forEach(slot => {
      const option = document.createElement('option');
      option.value = slot.startTime;
      option.textContent = `${slot.startTime} - ${slot.endTime}`;
      option.dataset.endTime = slot.endTime; // Store endTime for submission
      timeSelect.appendChild(option);
    });
  }
}

dateSelect.addEventListener('change', () => {
  populateTimeSelect(dateSelect.value);
});


const links = document.querySelectorAll('.footerLinks');
const footerInfoPopup = document.querySelector('.footerInfoPopup');
const closeFooterPopup = document.querySelector('.closeFooterPopup');
const footerInfoContent = document.querySelector('.footerInfoContent');
const footer = document.querySelector('footer')
function scrollToSection3(){
  availChartTxt1.scrollIntoView({ behavior: 'smooth', block: 'start' });
}function scrollToSection4(){
  footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// ...existing code...
links[0].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Over ons</h2>
    <br>
    <p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
  `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[1].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `
  <h2 class="footerInfoTxt1">Samenwerking met PTC</h2>
  <br>
    <p>
      <span><strong>LH-Cutzz</strong> is een partnerschap aangegaan met <strong>PTC</strong> om u de best mogelijke online ervaring te bieden.</span><br>
      <span>PTC is verantwoordelijk voor het beheer van de website, de online vindbaarheid en promotie, zodat meer klanten de weg naar LH-Cutzz vinden.</span>
    </p>
    <p>
      <span><strong>De rol van PTC:</strong></span><br>
      <span>– Websitebeheer en -onderhoud voor een snelle en betrouwbare ervaring.</span><br>
      <span>– Regelmatige updates van de galerij en het waarborgen van een professionele uitstraling.</span><br>
      <span>– Online marketing om de zichtbaarheid van LH-Cutzz te vergroten.</span><br>
      <span>– Technische ondersteuning, zodat LH-Cutzz zich volledig kan richten op het kappersvak.</span>
    </p>
    <p>
      <span><strong>De rol van LH-Cutzz:</strong></span><br>
      <span>– Het leveren van hoogwaardig knipwerk en uitstekende service.</span><br>
      <span>– Het aanleveren van content voor de website, zoals foto's en updates.</span><br>
      <span>– Het onderhouden van klantcontact en het bieden van een prettige ervaring in de salon.</span>
    </p>
    <p>
      <span><strong>De voordelen voor u als klant:</strong></span><br>
      <span>– Een professionele en betrouwbare website die de vindbaarheid van LH-Cutzz vergroot.</span><br>
      <span>– Een eenvoudig boekingsproces en een transparante galerij met authentiek werk.</span><br>
      <span>– De groei van LH-Cutzz door deze samenwerking, wat resulteert in meer beschikbaarheid en mogelijkheden voor u.</span>
    </p>
    <br>
    <span>Om een Feedback te geven of om vragen te stellen over de samenwerking kun je contact opnemen met PTC: <a style="color: #ffffff; font-size: 30px; font-family: sans-serif;" href="#" id="gmailLink">ptc.p.a.m.original@gmail.com</a>.</span>
    <br>
    <p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
  `;
  scrollToSection3();
  // Add Gmail link handler
  const gmailLink = document.getElementById('gmailLink');
  if (gmailLink) {
    gmailLink.addEventListener('click', function(e) {
      e.preventDefault();
      window.open('https://mail.google.com/mail/?view=cm&fs=1&to=ptc.p.a.m.original@gmail.com', '_blank');
    });
  }
  document.body.style.overflowY = 'hidden';
});

links[2].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `
    <h2 class="footerInfoTxt1">Beschikbare tijden</h2>
    <br>
    <p>
      <span>De kalender toont de actuele beschikbaarheid per dag en tijdslot.</span><br>
      <span>Een groen tijdslot geeft aan dat dit moment beschikbaar is voor een afspraak.</span><br>
      <span>Een grijs of gemarkeerd tijdslot betekent dat het moment al is gereserveerd.</span>
    </p>
    <p>
      <span>Kies een beschikbaar moment dat u schikt en vraag uw afspraak aan via het formulier.</span><br>
      <span>Na uw aanvraag ontvangt u zo spoedig mogelijk een bevestiging van LH-Cutzz.</span><br>
      <span>Zo bent u verzekerd van uw plek en staat u niet voor verrassingen.</span>
    </p>
    <p>
      <span>De kalender wordt continu bijgewerkt om de meest actuele informatie te garanderen.</span><br>
      <span>Staat uw voorkeurstijd er niet bij? Neem dan contact op om de mogelijkheden te bespreken.</span>
    </p>
    <p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
  `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[3].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Afspraken maken</h2>
    <br>
    <p>
      <span>Een afspraak maken bij LH-Cutzz is eenvoudig via onze website.</span><br>
      <span>1. Kies een beschikbare dag en tijd in de kalender.</span><br>
      <span>2. Controleer of het tijdslot groen is, wat betekent dat het beschikbaar is.</span><br>
      <span>3. Vul het formulier in met uw naam, telefoonnummer en de gewenste behandeling.</span><br>
      <span>4. Voeg eventuele extra wensen of opmerkingen toe in het daarvoor bestemde veld.</span><br>
      <span>Na het versturen van het formulier wordt uw aanvraag direct doorgestuurd.</span><br>
      <span>U ontvangt spoedig een bevestiging, waarmee uw afspraak definitief is.</span><br>
      <span>Wij zien u graag op het afgesproken tijdstip in onze salon.</span>
    </p>
    <p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
  `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[4].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Veelgestelde vragen</h2>
    <br>
    <p>
      <span><strong>Is het noodzakelijk om een afspraak te maken?</strong></span><br>
      <span>Ja, wij werken uitsluitend op afspraak om wachttijden te voorkomen en u de volledige aandacht te kunnen geven.</span><br><br>
      <span><strong>Hoe weet ik of mijn afspraak is bevestigd?</strong></span><br>
      <span>Nadat u het formulier heeft ingevuld, ontvangt u zo spoedig mogelijk een bevestiging via WhatsApp of telefoon.</span><br><br>
      <span><strong>Welke betaalmethoden accepteert u?</strong></span><br>
      <span>Momenteel accepteren wij contante betalingen. Eventuele nieuwe betaalopties worden op de website aangekondigd.</span><br><br>
      <span><strong>Kan ik mijn afspraak annuleren of verplaatsen?</strong></span><br>
      <span>Ja, dat is mogelijk. Wij verzoeken u vriendelijk om dit zo tijdig mogelijk door te geven via WhatsApp of telefoon, zodat wij het tijdslot opnieuw beschikbaar kunnen stellen.</span><br><br>
      <span><strong>Voert LH-Cutzz ook specifieke stijlen uit?</strong></span><br>
      <span>Zeker. Geef uw wensen aan bij het maken van de afspraak, dan bespreken we de mogelijkheden.</span>
    </p>
<p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
    `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[5].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Privacy en voorwaarden</h2>
    <br>
    <p>
      <span><strong>Privacybeleid</strong></span><br>
      <span>De persoonsgegevens die u verstrekt bij het maken van een afspraak, zoals uw naam en telefoonnummer, worden uitsluitend gebruikt voor het bevestigen en beheren van uw afspraak.</span><br>
      <span>Uw gegevens worden vertrouwelijk behandeld en niet met derden gedeeld.</span><br><br>
      <span><strong>Algemene voorwaarden</strong></span><br>
      <span>Een afspraak is definitief na ontvangst van een bevestiging van LH-Cutzz.</span><br>
      <span>Wij verzoeken u vriendelijk om op tijd voor uw afspraak aanwezig te zijn.</span><br>
      <span>Indien u verhinderd bent, gelieve dit zo spoedig mogelijk te melden via WhatsApp of telefoon.</span><br>
      <span>Voorwaarden met betrekking tot acties of kortingen worden altijd vooraf duidelijk gecommuniceerd.</span><br><br>
      <span><strong>Contact</strong></span><br>
      <span>Voor vragen over ons privacybeleid of de voorwaarden kunt u contact opnemen via de contactgegevens op de website.</span>
    </p>
<p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
    `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[6].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Contact</h2>
    <br>
    <p>
      <span>Heeft u vragen of wilt u direct contact opnemen?</span><br>
      <span>U kunt LH-Cutzz bereiken via de volgende gegevens:</span><br><br>
      <span><strong>WhatsApp:</strong> +31 6 12345678</span><br>
      <span><strong>Telefoon:</strong> +31 6 12345678</span><br>
      <span><strong>E-mail:</strong> info@lh-cutzz.nl</span><br><br>
      <span>Volg ons op sociale media voor de nieuwste stijlen en updates:</span><br>
      <span><strong>Instagram:</strong> <a href="https://instagram.com/lhcutzz" target="_blank" style="color:white; text-decoration:underline;">@lhcutzz</a></span><br>
      <span><strong>Snapchat:</strong> lhcutzz</span><br><br>
      <span>Adres van de shop wordt altijd bevestigd bij de afspraak.</span>
    </p>
<p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
    `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[7].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Diensten</h2>
    <br>
    <p>
      <span>Bij LH-Cutzz bieden wij een reeks professionele knip- en stylingdiensten aan.</span><br>
      <span>Elke behandeling wordt met de grootste zorg en precisie uitgevoerd om uw tevredenheid te garanderen.</span><br><br>
      <span><strong>Fresh Fade</strong> – Strakke en moderne fade, perfect afgewerkt.</span><br>
      <span><strong>Classic Cut</strong> – Tijdloze kapsels met een frisse uitstraling.</span><br>
      <span><strong>Line-ups & Shapes</strong> – Strakke lijnen en details voor een scherpe look.</span><br>
      <span><strong>Kinderen</strong> – Professionele knipbeurten voor kinderen.</span><br>
      <span><strong>Baard & Contour</strong> – Verzorgde baardtrim en strakke contouren.</span><br><br>
      <span>Heeft u een specifieke stijl in gedachten? Bespreek dit bij uw afspraak en wij zorgen voor een resultaat dat bij u past.</span><br>
      <span>Prijzen worden tijdens de afspraakbevestiging duidelijk gecommuniceerd.</span>
      </p>
<p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
      `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});

links[8].addEventListener('click', () => {
  footerInfoPopup.style.display = "flex";
  footerInfoContent.innerHTML = `  
    <h2 class="footerInfoTxt1">Locatie</h2>
    <br>
    <p>
      <span>Om de privacy van onze klanten en een rustige sfeer te waarborgen, wordt het adres van LH-Cutzz niet openbaar gedeeld.</span><br>
      <span>Alleen klanten met een bevestigde afspraak ontvangen de locatiegegevens.</span><br><br>
      <span>Nadat uw afspraak is bevestigd door LH-Cutzz, ontvangt u alle benodigde details, inclusief het adres en eventuele aanvullende informatie voor uw bezoek.</span><br><br>
      <span>Deze werkwijze stelt ons in staat om de planning efficiënt te beheren en wachttijden te minimaliseren.</span><br>
      <span>Bovendien garandeert het dat elke klant de persoonlijke aandacht krijgt die hij of zij verdient.</span><br><br>
      <span>Heeft u na het ontvangen van de bevestiging vragen over de route of bereikbaarheid? Neem dan gerust contact op voor nadere toelichting.</span>

      </p>
<p class="bsnsPrtnrsLogo">PTC <span style="font-weight: lighter; font-size: 40px;">x</span> LH-Cutzz</p>
      `;
  scrollToSection3();
  document.body.style.overflowY = 'hidden';
});
// ...existing code...
closeFooterPopup.addEventListener('click', () => {
  document.body.style.overflowY = 'scroll';
  footerInfoPopup.style.display = "none";
  scrollToSection4();
});



const mdBtn = document.querySelector('.darkLightModeBtn');
let isDark = true;

mdBtn.addEventListener('click', () => {
  if (isDark) {
    document.body.classList.add('light-mode');
    mdBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
  } else {
    document.body.classList.remove('light-mode');
    mdBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
  }
  isDark = !isDark;
});


const nvBrBtns = document.querySelectorAll('.nvBrBtnC .navBarBtn');
if (nvBrBtns.length > 0) {
  nvBrBtns[0].addEventListener('click', () => {
    // This now correctly simulates a click on the corresponding footer link
    links[0].click();
  });
}
if (nvBrBtns.length > 1) {
  nvBrBtns[1].addEventListener('click', () => {
    // This now correctly simulates a click on the corresponding footer link
    links[6].click();
  });
}


if (nvBrBtns.length > 2) {
  nvBrBtns[2].addEventListener('click', () => {
    footerInfoPopup.style.display = "flex";
    footerInfoContent.innerHTML = `
      <h2 class="footerInfoTxt1">Gallerij</h2>
      <div class="footerGalleryC"></div>
      <br>
    `;
    // FIX: Select the .footerGalleryC and append gallery videos inside it
    const galleryC = footerInfoContent.querySelector('.footerGalleryC');
    if (galleryC) {
      galleryC.appendChild(renderGalleryVideos());
    }
    scrollToSection3();
    document.body.style.overflowY = 'hidden';
  });
}

function renderGalleryVideos() {
  const galleryVideos = [
    { src: "img/gllryVid1.mp4", poster: "", muted: true, desc: "Low Taper Fade" },
    { src: "img/gllryVid3.mp4", poster: "", muted: true, desc: "Low Taper Fade" },
    { src: "img/gllryVid4.mp4", poster: "", muted: true, desc: "Low Taper Fade" },
  ];
  const galleryContainer = document.createElement('div');
  galleryContainer.className = "galleryVidC";

  galleryVideos.forEach((vid, idx) => {
    const vidItem = document.createElement('div');
    vidItem.className = "galleryVidItem";

    const video = document.createElement('video');
    video.muted = true;
    video.setAttribute('muted', vid.muted ? "muted" : "");
    video.setAttribute('preload', 'auto');
    if (vid.poster) video.setAttribute('poster', vid.poster);
    video.className = "galleryVid";
    video.innerHTML = `<source src="${vid.src}">`;

    const desc = document.createElement('div');
    desc.className = "galleryVidDesc";
    desc.textContent = vid.desc || "";

    vidItem.appendChild(video);
    vidItem.appendChild(desc);
    galleryContainer.appendChild(vidItem);

    let isHovering = false;
    const cutOff = 0.01;

    vidItem.addEventListener('mouseenter', () => {
      isHovering = true;
      video.currentTime = 0;
      video.loop = false;
      desc.style.color = '#ffffff'; // Only change the hovered item's desc
      video.play();
    });
    vidItem.addEventListener('mouseleave', () => {
      isHovering = false;
      desc.style.color = '#ffffff90'; // Only change the hovered item's desc
      video.pause();
      video.currentTime = 0;
    });
    video.addEventListener('timeupdate', () => {
      const stopTime = video.duration - cutOff;
      if (isHovering && video.currentTime >= stopTime) {
        video.currentTime = 0;
        video.play();
      }
    });
  });

  return galleryContainer;
}

const reviewClients = [
  // { name: "Jan de Vries", stars: 5, comment: "Top knipbeurt precies zoals ik wilde" },
];


if (nvBrBtns.length > 3) {
  nvBrBtns[3].addEventListener('click', () => {
    footerInfoPopup.style.display = "flex";
    footerInfoContent.innerHTML = `  <h2 class="footerInfoTxt1">Klantervaringen</h2>
    <span>Een selectie van vrijwillige beoordelingen van onze gewaardeerde klanten.</span>
    <br>`;
    scrollToSection3();
    document.body.style.overflowY = 'hidden';

    const reviewsContainer = document.createElement('div');
    reviewsContainer.className = 'reviewsContainer';

    reviewClients.forEach(client => {
      const reviewDiv = document.createElement('div');
      reviewDiv.className = 'reviewItem';

      const nameP = document.createElement('p');
      nameP.className = 'reviewName';
      nameP.textContent = client.name;

      const starsP = document.createElement('p');
      starsP.className = 'reviewStars';
      starsP.textContent = '★'.repeat(client.stars) + '☆'.repeat(5 - client.stars);

      const commentP = document.createElement('p');
      commentP.className = 'reviewComment';
      commentP.textContent = client.comment;

      reviewDiv.appendChild(nameP);
      reviewDiv.appendChild(starsP);
      reviewDiv.appendChild(commentP);

      reviewsContainer.appendChild(reviewDiv);
    });

    footerInfoContent.appendChild(reviewsContainer);
  });
}

// Lazy loading for .lazy-section elements
document.addEventListener("DOMContentLoaded", () => {
  const lazySections = document.querySelectorAll('.lazy-section');
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('lazy-loaded');
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: "0px",
    threshold: 0.1
  });

  lazySections.forEach(section => {
    observer.observe(section);
  });
});

if (doorgaan) {
  doorgaan.addEventListener("click", async () => {
    const selectedDateOption = dateSelect.options[dateSelect.selectedIndex];
    
    // Check if a date is selected
    if (!selectedDateOption || !selectedDateOption.dataset.fullDate) {
        alert("Selecteer alstublieft een geldige datum.");
        return;
    }

    const selectedTimeOption = timeSelect.options[timeSelect.selectedIndex];

    const data = {
      fullName: i1.value.trim(),
      phoneNumber: i2.value.trim(),
      date: selectedDateOption.dataset.fullDate, // Pass the machine-readable date
      time: timeSelect.value,
      treatment: i5.value.trim(),
      endTime: selectedTimeOption.dataset.endTime, // Pass the end time
      extraInfo: i6.value.trim(),
    };

    try {
      const resp = await fetch(API_APPOINTMENTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await resp.json();
      if (result.success) {
        // The backend now handles notifications. Just show a success message to the user.
        alert('✅ Afspraak succesvol aangevraagd! U ontvangt spoedig een bevestiging.');

        // The UI will be updated by the socket.io broadcast, but we can also update it immediately for a faster feel
        const key = appointmentToKey(result.appointment);
        if (key) bookedAppointmentSlots[key] = true;
        buildCalendar();
        populateDateSelect();
        form.reset(); // Clear the form fields
      } else {
        alert('Kon afspraak niet maken: ' + (result.error || 'Onbekende fout'));
      }
    } catch (err) {
      console.error('Error submitting appointment:', err);
      alert('Er is een fout opgetreden. Probeer het later opnieuw.');
    }

    popupC.style.display = "none";
    document.body.style.overflowY = "scroll";
  });
}
