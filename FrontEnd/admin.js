document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    const adminContent = document.getElementById('admin-content');
    const logoutBtn = document.getElementById('logout-btn');
    const appointmentsList = document.getElementById('appointments-list');
    const adminCalendarContainer = document.getElementById('admin-calendar-container');

    const API_BASE = `${API_HOST}/api/admin`;

    // connect socket.io
    const socket = io(API_HOST, {
        transports: ['websocket', 'polling'],
        secure: true,
        withCredentials: true
    });

    // Check if user is already logged in (token exists in sessionStorage)
    const token = sessionStorage.getItem('adminToken');
    if (token) {
        showAdminPanel();
        initializeAdminCalendar();
    }

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (data.success) {
                sessionStorage.setItem('adminToken', data.token);
                showAdminPanel();
                initializeAdminCalendar();
            } else {
                alert(`Inloggen mislukt: ${data.error}`);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Er is een fout opgetreden tijdens het inloggen. Probeer het opnieuw.');
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminToken');
        loginForm.style.display = 'block';
        adminContent.style.display = 'none';
        loginForm.parentElement.style.display = 'block';
        loginForm.reset();
    });

    function showAdminPanel() {
        loginForm.style.display = 'none';
        loginForm.parentElement.style.display = 'none';
        adminContent.style.display = 'block';
        // Initial data fetch
        fetchAndDisplayAppointments();
        fetchAndDisplaySlots();
    }

    async function fetchAndDisplayAppointments() {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            alert('U bent niet ingelogd.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/appointments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (data.success) {
                renderAppointments(data.appointments);
            } else {
                alert(`Fout bij het ophalen van afspraken: ${data.error}`);
                // If token is invalid, log out
                if (res.status === 401 || res.status === 403) {
                    logoutBtn.click();
                }
            }
        } catch (error) {
            console.error('Fetch appointments error:', error);
            alert('Kon de afspraken niet ophalen.');
        }
    }

    function renderAppointments(appointments) {
        appointmentsList.innerHTML = ''; // Clear list
        if (appointments.length === 0) {
            appointmentsList.innerHTML = '<li>Geen afspraken gevonden.</li>';
            return;
        }

        appointments.forEach(appt => {
            const li = document.createElement('li');
            // Add a class for styling instead of inline styles
            li.className = 'admin-appointment-item';
            li.innerHTML = `
                <div>
                    <strong>${appt.fullName}</strong> (${appt.phoneNumber})<br>
                    <small>${appt.date} om ${appt.time} - Behandeling: ${appt.treatment}</small>
                </div>
                <button class="delete-btn" data-id="${appt._id}" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Verwijderen</button>
            `;
            appointmentsList.appendChild(li);
        });
    }

    // Handle deleting an appointment
    appointmentsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const apptId = e.target.dataset.id;
            if (confirm('Weet u zeker dat u deze afspraak wilt verwijderen? Zo ja, informeer de klant zo snel moeglijk!')) {
                const token = sessionStorage.getItem('adminToken');
                const res = await fetch(`${API_BASE}/appointments/${apptId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) fetchAndDisplayAppointments(); // Refresh list
                else alert('Kon afspraak niet verwijderen: ' + data.error);
            }
        }
    });

    // --- Admin Calendar Logic ---
    let calendarData = { appointments: [], blockedSlots: [] };

    function initializeAdminCalendar() {
        // Listen for updates from the server
        socket.on('appointment_created', () => {
            fetchAndDisplayAppointments();
            fetchAndDisplaySlots();
        });
        socket.on('slot_updated', () => {
            fetchAndDisplaySlots();
        });
        socket.on('weekly_reset', () => {
            fetchAndDisplayAppointments();
            fetchAndDisplaySlots();
        });
    }

    async function fetchAndDisplaySlots() {
        const token = sessionStorage.getItem('adminToken');
        if (!token) return;

        try {
            const res = await fetch(`${API_BASE}/slots`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                calendarData.appointments = data.appointments;
                calendarData.blockedSlots = data.blockedSlots;
                buildAdminCalendar();
            } else {
                alert('Fout bij ophalen van slot data: ' + data.error);
            }
        } catch (error) {
            console.error('Fetch slots error:', error);
        }
    }

    function buildAdminCalendar() {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
        const firstDay = new Date(now);
        firstDay.setHours(0, 0, 0, 0);
        firstDay.setDate(now.getDate() + diffToMonday);

        const days = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
        const weekdaySlots = [{ startTime: '15:00' }, { startTime: '16:30' }];
        const weekendSlots = [{ startTime: '10:30' }, { startTime: '12:00' }, { startTime: '13:30' }, { startTime: '15:00' }, { startTime: '16:30' }];
        const allTimes = [...new Set([...weekdaySlots.map(s => s.startTime), ...weekendSlots.map(s => s.startTime)])].sort();

        const bookedKeys = new Set(calendarData.appointments.map(a => `${a.date}-${a.time}`));
        const blockedKeys = new Set(calendarData.blockedSlots.map(b => `${b.date}-${b.time}`));

        const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0, Sunday = 6

        let calendarHTML = '<div id="admin-calendar">';
        calendarHTML += '<div></div>'; // Empty corner
        days.forEach((day, index) => {
            if (index === todayIndex) {
                calendarHTML += `<div class="time"><strong style="font-size: 22px; color: #ffffff">${day}</strong></div>`;
            } else {
                calendarHTML += `<div class="time">${day}</div>`;
            }
        });

        allTimes.forEach(time => {
            calendarHTML += `<div class="time">${time}</div>`;
            for (let i = 0; i < 7; i++) {
                const currentDate = new Date(firstDay);
                currentDate.setDate(firstDay.getDate() + i);
                const machineDate = currentDate.getFullYear() + '-' + ('0' + (currentDate.getMonth() + 1)).slice(-2) + '-' + ('0' + currentDate.getDate()).slice(-2);

                const isWeekend = i >= 5;
                const daySlots = isWeekend ? weekendSlots : weekdaySlots;
                const slotExists = daySlots.some(s => s.startTime === time);

                if (!slotExists) {
                    calendarHTML += '<div class="slot booked" style="cursor: not-allowed; background: transparent !important;">———</div>';
                    continue;
                }

                const key = `${machineDate}-${time}`;
                let slotClass = 'slot';
                let slotText = 'Vrij';
                let slotStyle = 'cursor: pointer; background: #4CAF50;';

                if (bookedKeys.has(key)) {
                    slotClass = 'slot booked';
                    slotText = 'Bezet';
                    slotStyle = 'cursor: not-allowed; background: #555;';
                } else if (blockedKeys.has(key)) {
                    slotClass = 'slot blocked';
                    slotText = '———';
                    slotStyle = 'cursor: pointer; background: transparent; border: 1px solid #d9e6ffbd;';
                }

                calendarHTML += `<div class="${slotClass}" data-date="${machineDate}" data-time="${time}" style="${slotStyle}">${slotText}</div>`;
            }
        });

        calendarHTML += '</div>';
        adminCalendarContainer.innerHTML = calendarHTML;
    }

    adminCalendarContainer.addEventListener('click', async (e) => {
        const slot = e.target;
        if (!slot.classList.contains('slot') || slot.classList.contains('booked')) {
            return; // Ignore clicks on non-slots or booked slots
        }

        const date = slot.dataset.date;
        const time = slot.dataset.time;
        const isBlocked = slot.classList.contains('blocked');

        if (isBlocked) {
            // Unblock it
            if (confirm(`Weet u zeker dat u ${date} om ${time} wilt vrijgeven?`)) {
                await sendSlotUpdate('unblock-slot', { date, time });
            }
        } else {
            // Block it
            if (confirm(`Weet u zeker dat u ${date} om ${time} wilt blokkeren?`)) {
                await sendSlotUpdate('block-slot', { date, time });
            }
        }
    });

    async function sendSlotUpdate(endpoint, body) {
        const token = sessionStorage.getItem('adminToken');
        try {
            const res = await fetch(`${API_BASE}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!data.success) {
                alert(`Actie mislukt: ${data.error}`);
            }
            // The UI will be updated via the socket event, no need to do anything else here.
        } catch (error) {
            console.error(`Slot update error (${endpoint}):`, error);
            alert('Er is een serverfout opgetreden.');
        }
    }
});