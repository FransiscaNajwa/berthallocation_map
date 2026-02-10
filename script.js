document.addEventListener('DOMContentLoaded', () => {
    // Global error handler untuk catch semua JavaScript errors
    window.addEventListener('error', (event) => {
        console.error('🔴 GLOBAL ERROR:', event.error);
        console.error('Message:', event.message);
        console.error('Stack:', event.error?.stack);
    });
    
    const KD_MARKERS = Array.from({ length: (650 - 330) / 10 + 1 }, (_, i) => 330 + i * 10);
    const HOUR_WIDTH = 25;
    const KD_HEIGHT_UNIT = 40;
    const KD_MIN = Math.min(...KD_MARKERS);
    const PENDING_FORM_KEY = 'pendingShipForm';
    const API_BASE_URL = 'http://localhost:3001'; // Backend API URL

    let shipSchedules = [];
    let editingShipIndex = null;
    let currentStartDate = getStartOfWeek(new Date());

    let maintenanceSchedules = [];
    let editingMaintenanceIndex = null;

    let restSchedules = [];
    let editingRestIndex = null;

    let draggableLineLeft = 200;

    // Helper function untuk API calls
    async function apiCall(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            if (data) {
                options.body = JSON.stringify(data);
            }
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            alert('Terjadi kesalahan: ' + error.message);
            throw error;
        }
    }

    // Helper function untuk DELETE requests (dengan query parameters)
    async function apiDelete(type, id) {
        try {
            const response = await fetch(`${API_BASE_URL}/delete_data.php?id=${id}&type=${type}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API delete error:', error);
            alert('Terjadi kesalahan saat menghapus: ' + error.message);
            throw error;
        }
    }

    // Load data dari database saat inisialisasi
    async function loadDataFromDatabase() {
        try {
            const result = await apiCall('get_all_data.php');
            shipSchedules = result.shipSchedules || [];
            maintenanceSchedules = result.maintenanceSchedules || [];
            restSchedules = result.restSchedules || [];
            console.log('Data loaded from database:', { shipSchedules, maintenanceSchedules, restSchedules });
        } catch (error) {
            console.error('Failed to load data:', error);
            // Fallback ke empty arrays jika API gagal
            shipSchedules = [];
            maintenanceSchedules = [];
            restSchedules = [];
        }
    } 

    const ccLineColors = {
        'CC01': '#d14c62ff', 
        'CC02': '#0000FF', 
        'CC03': '#17A2B8', 
        'CC04': '#b5a02aff'  
    };

    const grid = document.getElementById('grid');
    const yAxis = document.querySelector('.y-axis');
    const xAxis = document.querySelector('.x-axis');
    const hourAxis = document.getElementById('hour-axis');
    const modal = document.getElementById('ship-modal');
    const addShipBtn = document.getElementById('add-ship-btn');
    const closeModalBtn = modal.querySelector('.close-btn');
    const shipForm = document.getElementById('ship-form');
    const modalTitle = document.getElementById('modal-title');
    const formSubmitBtn = shipForm.querySelector('button[type="submit"]');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    
    const weekDatePicker = document.getElementById('week-date-picker');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const berthLabelsContainer = document.querySelector('.berth-labels-container');
    const berthMapContainer = document.getElementById('berth-map-container');

    const addMaintenanceBtn = document.getElementById('add-maintenance-btn');
    const maintenanceModal = document.getElementById('maintenance-modal');
    const maintenanceCloseBtn = maintenanceModal.querySelector('.close-btn');
    const maintenanceForm = document.getElementById('maintenance-form');
    const maintenanceModalTitle = document.getElementById('maintenance-modal-title');
    const maintenanceSubmitBtn = maintenanceForm.querySelector('button[type="submit"]');

    const addRestBtn = document.getElementById('add-rest-btn');
    const restModal = document.getElementById('rest-modal');
    const restCloseBtn = restModal.querySelector('.close-btn');
    const restForm = document.getElementById('rest-form');
    const restModalTitle = document.getElementById('rest-modal-title');
    const restSubmitBtn = restForm.querySelector('button[type="submit"]');

    const deleteShipBtn = document.getElementById('delete-ship-btn');
    const deleteMaintenanceBtn = document.getElementById('delete-maintenance-btn');
    const deleteRestBtn = document.getElementById('delete-rest-btn');

    const berthDividerLine = document.getElementById('berth-divider-line');
    const currentTimeIndicator = document.getElementById('current-time-indicator');


    function renderShips() {
        grid.querySelectorAll('.ship-wrapper').forEach(el => el.remove());

        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        // BATAS MAKSIMAL: 7 hari * 24 jam * lebar per jam
        const MAX_GRID_WIDTH = 7 * 24 * HOUR_WIDTH; 

        const visibleShips = shipSchedules.filter(ship => {
            if (!ship.etaTime || !ship.endTime) return false;
            const shipETA = new Date(ship.etaTime);
            const shipETD = new Date(ship.endTime);
            // Filter: Hanya ambil yang waktunya beririsan dengan minggu ini
            return shipETA < weekEnd && shipETD > weekStart;
        });

        visibleShips.forEach((ship) => {
            const shipIndex = shipSchedules.indexOf(ship);
            const eta = new Date(ship.etaTime);
            const etb = new Date(ship.startTime);
            const etc = ship.etcTime ? new Date(ship.etcTime) : null;
            const etd = new Date(ship.endTime);

            if (isNaN(eta) || isNaN(etb) || isNaN(etd)) return;

            const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);
            
            // 1. Hitung Posisi Mentah (Bisa minus atau melebihi layar)
            let rawLeft = getHoursSinceWeekStart(eta) * HOUR_WIDTH;
            let rawWidth = ((etd.getTime() - eta.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH;
            rawWidth = Math.max(rawWidth, HOUR_WIDTH / 2); // Minimal lebar

            // 2. LOGIKA PEMOTONGAN (CLIPPING)
            let finalLeft = Math.max(0, rawLeft);
            let leftCropAmount = finalLeft - rawLeft;
            let rightEdge = Math.min(MAX_GRID_WIDTH, rawLeft + rawWidth);
            let finalWidth = rightEdge - finalLeft;
            if (finalWidth <= 0) return;


            // --- Hitung Vertikal (Tetap sama) ---
            const kdUnitPx = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]);
            const top = (ship.startKd - KD_MIN) * kdUnitPx;
            const calculatedHeight = ship.length * kdUnitPx;
            const height = Math.max(calculatedHeight, KD_HEIGHT_UNIT / 2); 
            const finalTop = Math.max(top, 0);


            // --- Logika Konten di Dalam Wrapper ---
            let rawContentLeft = ((etb.getTime() - eta.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH;
            let rawContentWidth = ((etd.getTime() - etb.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH;
            let adjustedContentLeft = rawContentLeft - leftCropAmount;
            let finalContentLeft = Math.max(0, adjustedContentLeft);
            let contentCropAmount = finalContentLeft - adjustedContentLeft;
            let finalContentWidth = rawContentWidth - contentCropAmount;
            if (finalContentLeft + finalContentWidth > finalWidth) {
                finalContentWidth = finalWidth - finalContentLeft;
            }
            
            // --- Border untuk Jadwal Kapal ---
            const company = ship.company ? ship.company.toUpperCase() : 'UNKNOWN';
            let logoUrl = '', companyColor = '#718096';
            switch(company) {
                case 'MERATUS': logoUrl = './MRTS.png'; companyColor = '#001F5B'; break;
                case 'TANTO':   logoUrl = './TANTO.png'; companyColor = '#00AEEF'; break;
                case 'SPIL':    logoUrl = './SPIL.png'; companyColor = '#3BB54A'; break;
                case 'CTP':     logoUrl = './CTP.png'; companyColor = '#B65A0A'; break;
                case 'PPNP':    logoUrl = './PPNP.png'; companyColor = '#FF0000'; break;
                case 'LINE':    logoUrl = './Lines.jpg'; companyColor = '#e38111ff'; break;
                case 'ICON':    logoUrl = './icon.jpg'; companyColor = '#dd15abff'; break;
            }
            const statusColors = {
                "VESSEL ALONGSIDE": "#00c853",
                "VESSEL ON PLOTTING": "#ffff00",
                "VESSEL ON PLANNING": "#bfbfbf",
                "VESSEL DEPART": "#9c27b0",
                "CRANE/BERTH MAINTENANCE": "#ffc000",
            };
            const footerColor = statusColors[ship.status] || '#718096';
            
            const bodyTextLines = [
                `${ship.length || '?'}m /${ship.draft || '?'} /${ship.destPort || '-'} `,
                `${ship.berthSide || '?'} / ${ship.startKd || '?'} / ${ship.nKd || '?'} / ${ship.minKd || '?'}`,
                `<b>${formatDateTime(eta).replace(' / ', '/')} / ${formatDateTime(etb).replace(' / ', '/')} / ${formatDateTime(etc).replace(' / ', '/')} / ${formatDateTime(etd).replace(' / ', '/')}</b>`,
                `D ${ship.dischargeValue || 0} / L ${ship.loadValue || 0}`,
            ];

            let ccLinesHTML = '';
            const shipQCCs = ship.qccName ? ship.qccName.split(' & ') : [];
            
            if (shipQCCs.length > 0) {
                let linesContent = '';
                shipQCCs.forEach(qcc => {
                    let color = '#333'; 
                    if (qcc.includes('01')) color = '#d14c62ff'; 
                    else if (qcc.includes('02')) color = '#0000FF'; 
                    else if (qcc.includes('03')) color = '#17A2B8'; 
                    else if (qcc.includes('04')) color = '#b5a02aff'; 
                    
                    linesContent += `
                        <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 4px;">
                            <span style="color: #333; margin-bottom: 2px;">${qcc}</span>
                            <div class="cc-line-item" style="border-top: 2px dashed ${color}; width: 100%; height: 0px;"></div>
                        </div>
                    `;
                });
                ccLinesHTML = `
                    <div class="cc-lines-container" style="display: flex; flex-direction: column; width: 100%; margin-top: 5px;">
                        ${linesContent}
                    </div>
                `;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'ship-wrapper';
            wrapper.style.top = `${finalTop}px`;
            wrapper.style.left = `${finalLeft}px`;
            wrapper.style.width = `${finalWidth}px`; 
            wrapper.style.height = `${height}px`;

            wrapper.innerHTML = `
                <div class="ship-content" style="left: ${finalContentLeft}px; width: ${finalContentWidth}px; border-color: ${companyColor};">
                    
                    <div class="ship-header">
                        <div class="ship-header-text">
                            <span class="ship-main-title">${company} ${ship.shipName || 'N/A'}</span>
                            <span class="ship-sub-title">${ship.code || 'N/A'}</span>
                        </div>
                        ${logoUrl ? `<img src="${logoUrl}" class="ship-logo" alt="${company} logo" onerror="this.style.display='none';"/>` : ''}
                    </div>
                    
                    <div class="ship-body">
                        <div>${bodyTextLines.join('\n').trim()}</div>
                        
                        ${ccLinesHTML}
                    </div>

                </div>
                
                <div class="ship-footer" style="background-color: ${footerColor};">
                    <span class="footer-left"></span>
                    <span class="footer-center">${ship.status || 'N/A'}</span>
                    <span class="footer-right">BSH: ${ship.bsh || ''} / ${ship.berthSide || ''}</span>
                </div>
            `;
            
            wrapper.addEventListener('dblclick', () => editShip(shipIndex));
            wrapper.title = 'Double click untuk mengedit';
            grid.appendChild(wrapper); 
        });
    }


    function renderMaintenance() {
        grid.querySelectorAll('.maintenance-block, .no-vessel-block').forEach(el => el.remove());
        
        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        const MAX_GRID_WIDTH = 7 * 24 * HOUR_WIDTH; 

        const visibleMaintenance = maintenanceSchedules.filter(item => {
            if (!item.startTime || !item.endTime) return false;
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            return startTime < weekEnd && endTime > weekStart;
        });

        visibleMaintenance.forEach((item, index) => {
            const itemIndex = maintenanceSchedules.indexOf(item);
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);

            let rawLeft = getHoursSinceWeekStart(startTime) * HOUR_WIDTH;
            let rawWidth = ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH;
            
            // LOGIKA PEMOTONGAN
            let finalLeft = Math.max(0, rawLeft);
            let rightEdge = Math.min(MAX_GRID_WIDTH, rawLeft + rawWidth);
            let finalWidth = rightEdge - finalLeft;

            if (finalWidth <= 0) return;

            const kdUnitPx = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]);
            const top = (item.startKd - KD_MIN) * kdUnitPx;
            const maintenanceLength = Math.max((item.endKd - item.startKd), 10); 
            const height = Math.max(maintenanceLength * kdUnitPx, KD_HEIGHT_UNIT / 2); 
            const finalTop = Math.max(top, 0);

            const block = document.createElement('div');
            block.className = (item.type === 'no-vessel') ? 'no-vessel-block' : 'maintenance-block';
            block.style.top = `${finalTop}px`;
            block.style.left = `${finalLeft}px`;
            block.style.width = `${finalWidth}px`;
            block.style.height = `${height}px`;
            
            if (item.type === 'no-vessel') {
                block.innerHTML = `<span>No Vessel<br>Free for Maintenance</span>`; 
                block.title = `Area Kosong: ${item.keterangan}`;
            } else {
                block.textContent = item.keterangan;
                block.title = `Maintenance: ${item.keterangan}`;
            }
            block.addEventListener('dblclick', () => editMaintenance(itemIndex));
            grid.appendChild(block);
        });
    }

    
    function renderRestTimes() {
        grid.querySelectorAll('.rest-block').forEach(el => el.remove());
        const weekStart = new Date(currentStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        const MAX_GRID_WIDTH = 7 * 24 * HOUR_WIDTH; // Limit Grid

        const visibleRestTimes = restSchedules.filter(item => {
             if (!item.startTime || !item.endTime) return false;
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            return startTime < weekEnd && endTime > weekStart;
        });
        visibleRestTimes.forEach(item => {
            const itemIndex = restSchedules.indexOf(item);
            const startTime = new Date(item.startTime);
            const endTime = new Date(item.endTime);
            const getHoursSinceWeekStart = (date) => (date.getTime() - weekStart.getTime()) / (1000 * 60 * 60);
            
            let rawLeft = getHoursSinceWeekStart(startTime) * HOUR_WIDTH;
            let rawWidth = ((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)) * HOUR_WIDTH;

            // LOGIKA PEMOTONGAN
            let finalLeft = Math.max(0, rawLeft);
            let rightEdge = Math.min(MAX_GRID_WIDTH, rawLeft + rawWidth);
            let finalWidth = rightEdge - finalLeft;

            if (finalWidth <= 0) return;

            const block = document.createElement('div');
            block.className = 'rest-block';
            block.style.top = '0px';
            block.style.height = grid.style.height; 
            block.style.left = `${finalLeft}px`;
            block.style.width = `${finalWidth}px`;
            block.textContent = item.keterangan || 'BREAK';
            block.title = `${item.keterangan} (Double click untuk mengedit)`;
            block.addEventListener('dblclick', () => editRestTime(itemIndex));
            grid.appendChild(block);
        });
    }
 
    function createDraggableCCLines() {
        const ccNames = ['CC04', 'CC03', 'CC02', 'CC01'];
        let initialTopPosition = 50; 

        ccNames.forEach(name => {
            const line = document.createElement('div');
            line.className = 'draggable-cc-line';
            line.id = `cc-line-${name}`;
            line.style.top = `${initialTopPosition}px`;
            
            line.style.borderTopColor = ccLineColors[name];

            grid.appendChild(line);
            
            initialTopPosition += 30; 
        });
    }
 

    async function saveCommLog() {
        const table = document.getElementById('comm-log-table');
        const rows = table.querySelectorAll('tbody tr');
        const data = [];

        rows.forEach(row => {
            // Ambil datetime input
            const datetimeInput = row.querySelector('input[type="datetime-local"]');
            
            // Ambil contenteditable cells (skip yang pertama karena itu No.)
            const contentEditableCells = row.querySelectorAll('td[contenteditable="true"]');
            
            if (datetimeInput && contentEditableCells.length >= 5) {
                // Convert datetime-local (2026-02-09T15:30) ke MySQL format (2026-02-09 15:30:00)
                let dateTimeValue = datetimeInput.value;
                if (dateTimeValue) {
                    dateTimeValue = dateTimeValue.replace('T', ' ') + ':00';
                }

                const rowData = {
                    dateTime: dateTimeValue,
                    petugas: contentEditableCells[0].textContent,
                    stakeholder: contentEditableCells[1].textContent,
                    pic: contentEditableCells[2].textContent,
                    remark: contentEditableCells[3].textContent,
                    commChannel: contentEditableCells[4].textContent,
                };
                data.push(rowData);
            }
        });

        console.log('📤 Sending data to API:', data);

        try {
            const response = await fetch('save_comm_log.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const responseText = await response.text();
            console.log('📥 Raw response:', responseText);

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Failed to parse JSON:', e);
                alert('❌ Error: Response tidak valid dari server');
                return false;
            }

            if (result.status === 'success') {
                console.log('✅ Communication log saved successfully:', result.message);
                return true;
            } else {
                console.error('❌ API Error:', result.message);
                alert('❌ Gagal menyimpan: ' + result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Network/API Error:', error);
            alert('❌ Error API: ' + error.message);
            return false;
        }
    }

    async function loadCommLog() {
        console.log('📥 Loading Communication Log from database...');
        
        try {
            const response = await fetch('get_comm_log.php');
            const responseText = await response.text();
            console.log('📥 Raw response:', responseText);

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (e) {
                console.error('❌ Failed to parse JSON:', e);
                return;
            }

            if (result.status !== 'success' || !result.data) {
                console.log('📭 No communication log data found or error:', result.message);
                return;
            }

            const data = result.data;
            console.log('✅ Loaded', data.length, 'communication log entries');

            const table = document.getElementById('comm-log-table');
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach((row, index) => {
                if (!data[index]) return;

                // Store the ID in data attribute for deletion
                row.setAttribute('data-id', data[index].id);

                // Set datetime input
                const datetimeInput = row.querySelector('input[type="datetime-local"]');
                if (datetimeInput && data[index].dateTime) {
                    // Convert MySQL format (2026-02-09 15:30:00) ke datetime-local (2026-02-09T15:30)
                    const dateTimePart = data[index].dateTime.split(' ');
                    if (dateTimePart.length >= 2) {
                        const datePart = dateTimePart[0]; // 2026-02-09
                        const timePart = dateTimePart[1].substring(0, 5); // 15:30 (exclude seconds)
                        datetimeInput.value = datePart + 'T' + timePart;
                    }
                }

                // Set contenteditable cells
                const contentEditableCells = row.querySelectorAll('td[contenteditable="true"]');
                if (contentEditableCells.length >= 5) {
                    contentEditableCells[0].textContent = data[index].petugas || '';
                    contentEditableCells[1].textContent = data[index].stakeholder || '';
                    contentEditableCells[2].textContent = data[index].pic || '';
                    contentEditableCells[3].textContent = data[index].remark || '';
                    contentEditableCells[4].textContent = data[index].commChannel || 'WAG';
                }
            });

            console.log('✅ Communication log loaded from database');
        } catch (error) {
            console.error('❌ Error loading communication log:', error);
        }
    }

    function setupCommLogDeleteButtons() {
        const table = document.getElementById('comm-log-table');
        const deleteButtons = table.querySelectorAll('.btn-delete-row');

        deleteButtons.forEach((btn, index) => {
            btn.addEventListener('click', async () => {
                const row = btn.closest('tr');
                const rowId = row.getAttribute('data-id');

                if (confirm('Anda yakin ingin menghapus baris komunikasi log ini?')) {
                    try {
                        // Delete dari database jika ada ID
                        if (rowId) {
                            const deleteResponse = await fetch(`delete_data.php?id=${rowId}&type=communication`);
                            const deleteResult = await deleteResponse.json();
                            
                            if (deleteResult.status !== 'success') {
                                alert('❌ Gagal menghapus dari database: ' + deleteResult.message);
                                return;
                            }
                            console.log('✅ Row deleted from database, ID:', rowId);
                        }

                        // Clear the row in UI
                        const datetimeInput = row.querySelector('input[type="datetime-local"]');
                        if (datetimeInput) {
                            datetimeInput.value = '';
                        }

                        const contentEditableCells = row.querySelectorAll('td[contenteditable="true"]');
                        contentEditableCells.forEach((cell, idx) => {
                            if (idx < contentEditableCells.length - 1) {
                                cell.textContent = '';
                            } else {
                                cell.textContent = 'WAG';
                            }
                        });

                        // Remove data-id attribute since we cleared the row
                        row.removeAttribute('data-id');
                        
                        console.log('🗑️ Row', index + 1, 'deleted and cleared');
                        alert('✅ Baris komunikasi log berhasil dihapus!');
                    } catch (error) {
                        console.error('❌ Error deleting row:', error);
                        alert('❌ Error: ' + error.message);
                    }
                }
            });
        });
    }

     function savePendingForm() {
         if (editingShipIndex === null) {
             const formData = new FormData(shipForm);
             const data = Object.fromEntries(formData.entries());
             sessionStorage.setItem(PENDING_FORM_KEY, JSON.stringify(data));
         }
    }
    function loadPendingForm() {
        const data = JSON.parse(sessionStorage.getItem(PENDING_FORM_KEY));
        if (data) {
            for (const key in data) {
                if (shipForm.elements[key]) {
                    shipForm.elements[key].value = data[key];
                }
            }
        }
    }
    function clearPendingForm() {
        sessionStorage.removeItem(PENDING_FORM_KEY);
        shipForm.reset();
    }

    function getStartOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    function formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    function formatDateTime(date) {
        if (!date || isNaN(new Date(date))) return '-';
        const d = new Date(date);
        const day = d.getDate().toString();
        const hour = d.getHours().toString().padStart(2, '0');
        const minute = d.getMinutes().toString().padStart(2, '0');
        const timeString = hour + minute;
        return `${day} / ${timeString}`;
    }
    function formatForInput(date) {
        if (!date) return '';
        try {
            const d = new Date(date);
            if (isNaN(d)) return '';
            const pad = (num) => num.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch (e) {
            console.error("Error formatting date for input:", date, e);
            return '';
        }
    }
    function formatDateForPDF(d) {
        return d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    }

    function formatDateForDateInput(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d)) return '';
        const pad = (num) => num.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }


    async function initialize() {
        // Load data from database first, then update UI
        await loadDataFromDatabase();
        updateDisplay(); 
        setupEventListeners();
        await loadCommLog();
    }

    function drawGrid() {
        yAxis.innerHTML = ''; xAxis.innerHTML = ''; hourAxis.innerHTML = ''; berthLabelsContainer.innerHTML = '';
        grid.innerHTML = ''; 
        const gridContainer = grid.parentElement; 

        const oldSeparator = berthMapContainer.querySelector('.berth-separator');
        if (oldSeparator) oldSeparator.remove();

        const totalHours = 24 * 7; 
        const totalGridWidth = totalHours * HOUR_WIDTH; 
        const totalKdSteps = KD_MARKERS.length; 

        
        grid.style.position = 'relative'; 
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${totalHours}, ${HOUR_WIDTH}px)`;
        grid.style.gridTemplateRows = `repeat(${totalKdSteps}, ${KD_HEIGHT_UNIT}px)`;
        grid.style.height = `${(totalKdSteps) * KD_HEIGHT_UNIT}px`;
        grid.style.width = `${totalGridWidth}px`; 
    

        for (let row = 0; row < totalKdSteps; row++) {
            for (let col = 0; col < totalHours; col++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                grid.appendChild(cell);
            }
        }

        const divider = document.createElement('div');
        divider.id = 'berth-divider-line';
        grid.appendChild(divider);

        const timeIndicator = document.createElement('div');
        timeIndicator.id = 'current-time-indicator';
        grid.appendChild(timeIndicator);

        // createDraggableCCLines();

        const kdUnitPx = KD_HEIGHT_UNIT; 
        KD_MARKERS.forEach(kd => {
            const label = document.createElement('div');
            label.className = 'kd-label';
            if (kd === 490) label.classList.add('bold');
            label.textContent = kd;
            label.style.height = `${kdUnitPx}px`;
            yAxis.appendChild(label);
        });

 
        const berths = [
            { name: 'BERTH 2', startKd: 330, endKd: 490, ccs: ['CC04', 'CC03'] },
            { name: 'BERTH 1', startKd: 490, endKd: 650, ccs: ['CC02', 'CC01'] }
        ];

      
        const ccColors = {
            'CC01': '#d14c62ff', 
            'CC02': '#0000FF', 
            'CC03': '#17A2B8', 
            'CC04': '#b5a02aff'  
        };
      

        berths.forEach(berth => {
            const berthLabelContainer = document.createElement('div');
            berthLabelContainer.className = 'berth-label-container';

            const innerLabelWrapper = document.createElement('div');
            innerLabelWrapper.className = 'berth-label'; 

        
            const kdStepHeight = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]); 
            const top = (berth.startKd - KD_MIN) * kdStepHeight;
            const height = (berth.endKd - berth.startKd) * kdStepHeight;
            berthLabelContainer.style.top = `${top}px`;
            berthLabelContainer.style.height = `${height}px`;

        
            innerLabelWrapper.style.display = 'flex';
            innerLabelWrapper.style.flexDirection = 'row'; 
            innerLabelWrapper.style.width = `${height}px`; 
            innerLabelWrapper.style.justifyContent = 'space-evenly'; 
            innerLabelWrapper.style.alignItems = 'center'; 
            innerLabelWrapper.style.paddingLeft = '0';
            innerLabelWrapper.style.paddingRight = '0';

            
            const ccEl_Top = document.createElement('div');
            const ccTopName = berth.ccs[1]; 
            ccEl_Top.textContent = ccTopName; 
            ccEl_Top.style.fontSize = '0.9em';
       
            ccEl_Top.style.color = ccColors[ccTopName] || 'red'; 
            innerLabelWrapper.appendChild(ccEl_Top);


            const nameEl = document.createElement('div');
            nameEl.textContent = berth.name;
            nameEl.style.fontWeight = 'bold';
            nameEl.style.fontSize = '1.1em';
            innerLabelWrapper.appendChild(nameEl);

            const ccEl_Bottom = document.createElement('div');
            const ccBottomName = berth.ccs[0]; 
            ccEl_Bottom.textContent = ccBottomName; 
            ccEl_Bottom.style.fontSize = '0.9em';
            ccEl_Bottom.style.color = ccColors[ccBottomName] || 'red'; 
            innerLabelWrapper.appendChild(ccEl_Bottom);

            berthLabelContainer.appendChild(innerLabelWrapper);
            berthLabelsContainer.appendChild(berthLabelContainer);
        });


        gridContainer.style.width = `${totalGridWidth}px`; 
        xAxis.style.width = `${totalGridWidth}px`; 

        const currentDay = new Date(currentStartDate);
        for (let i = 0; i < 7; i++) {
            const dayLabel = document.createElement('div');
            dayLabel.className = 'day-label';
            dayLabel.textContent = currentDay.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long' });
            dayLabel.style.width = `${24 * HOUR_WIDTH}px`;
            xAxis.appendChild(dayLabel);

            for (let h = 0; h < 24; h += 2) { 
                const hourLabel = document.createElement('div');
                hourLabel.className = 'hour-label';
                hourLabel.textContent = h.toString().padStart(2, '0');
                hourLabel.style.width = `${2 * HOUR_WIDTH}px`; 
                hourAxis.appendChild(hourLabel);
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }

        updateBerthDividerPosition();
        const lineElement = document.getElementById('current-time-indicator');
        if (lineElement) {
             lineElement.style.left = `${draggableLineLeft}px`;
             makeLineDraggable(lineElement);
        } else {
            console.error("Element #current-time-indicator not found after grid creation");
        }
    }

    function updateBerthDividerPosition() {
        const divider = document.getElementById('berth-divider-line');
        if (divider) {
             const kdStepHeight = KD_HEIGHT_UNIT / (KD_MARKERS[1] - KD_MARKERS[0]); 
             const topPosition = (490 - KD_MIN) * kdStepHeight;
             divider.style.top = `${topPosition - 1}px`; 
        }
    }

    function updateCurrentTimeIndicator() {
         console.log("updateCurrentTimeIndicator called, but logic is disabled for manual dragging.");
    }

    function makeLineDraggable(line) {
        if (!line) {
            console.error("makeLineDraggable called with null element");
            return;
        }
        let isDragging = false;
        let initialX;
        let initialLeft;

        line.removeEventListener('mousedown', onMouseDown);

        function onMouseDown(e) {
             e.preventDefault();
             isDragging = true;
             initialX = e.clientX;
             initialLeft = line.offsetLeft;
             document.addEventListener('mousemove', onDrag);
             document.addEventListener('mouseup', onDragEnd);
             console.log("Draggable line: Mouse Down");
        }

        function onDrag(e) {
            if (!isDragging) return;
            e.preventDefault();

            const dx = e.clientX - initialX;
            let newLeft = initialLeft + dx;

            const gridWidth = grid.scrollWidth;
            newLeft = Math.max(0, Math.min(newLeft, gridWidth - line.offsetWidth));

            draggableLineLeft = newLeft; 
            line.style.left = `${newLeft}px`; 
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
            localStorage.setItem('draggableLinePosition', JSON.stringify(draggableLineLeft));
            console.log("Draggable line: Mouse Up, Position saved:", draggableLineLeft);
        }

        line.addEventListener('mousedown', onMouseDown);

    }

    function updateDisplay() {
        weekDatePicker.value = formatDateForDateInput(currentStartDate);

        drawGrid(); 
        renderRestTimes();
        renderMaintenance();
        renderShips();
    }

    function fillFormForEdit(ship) {
        try {
            document.getElementById('ship-company').value = ship.company || '';
            document.getElementById('ship-name').value = ship.shipName || '';
            document.getElementById('ship-code').value = ship.code || '';
            document.getElementById('ship-length').value = ship.length || '';
            document.getElementById('ship-draft').value = ship.draft || '';
            document.getElementById('dest-port').value = ship.destPort || '';
            
            // PENTING: Validate dan set startKd dengan benar
            const startKdValue = parseInt(ship.startKd, 10);
            if (isNaN(startKdValue) || startKdValue === 0) {
                console.error('Invalid startKd from database:', ship.startKd);
                alert('Error: Start KD data tidak valid (' + ship.startKd + ')');
                return;
            }
            document.getElementById('start-kd').value = startKdValue;
            const nKdValue = parseInt(ship.nKd, 10);
            document.getElementById('n-kd').value = isNaN(nKdValue) ? '' : nKdValue;
            document.getElementById('min-kd').value = ship.minKd || '';
            
            document.getElementById('load-value').value = ship.loadValue || 0;
            document.getElementById('discharge-value').value = ship.dischargeValue || 0;
            document.getElementById('eta-time').value = formatForInput(ship.etaTime);
            document.getElementById('start-time').value = formatForInput(ship.startTime);
            document.getElementById('etc-time').value = formatForInput(ship.etcTime);
            document.getElementById('end-time').value = formatForInput(ship.endTime);
            document.getElementById('ship-status').value = ship.status || '';
            document.getElementById('ship-berth-side').value = ship.berthSide || '';
            document.getElementById('ship-bsh').value = ship.bsh || '';
            
            document.querySelectorAll('#qcc-checkbox-group input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });

            const savedQCCs = ship.qccName || ''; 
            if (savedQCCs) {
                const qccArray = savedQCCs.split(' & ');
                qccArray.forEach(qccValue => {
                    const checkbox = document.querySelector(`#qcc-checkbox-group input[value="${qccValue}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            // Trigger calculations after form is populated
            setTimeout(() => {
                calculateEndKdAndMean();
                calculateEtcAndEtd();
            }, 100);
        } catch (error) {
            console.error('Error filling form for edit:', error, ship);
            alert('Error saat load data kapal: ' + error.message);
        }
    }
    function editShip(index) {
        editingShipIndex = index;
        fillFormForEdit(shipSchedules[index]);
        modalTitle.textContent = 'Edit Jadwal Kapal';
        formSubmitBtn.textContent = 'Update Jadwal';
        shipForm.classList.add('edit-mode');
        deleteShipBtn.onclick = async () => {
            if (confirm('Anda yakin ingin menghapus jadwal kapal ini?')) {
                try {
                    const shipId = shipSchedules[editingShipIndex].id;
                    await apiDelete('ship', shipId);
                    shipSchedules.splice(editingShipIndex, 1);
                    updateDisplay();
                    modal.style.display = 'none';
                    shipForm.classList.remove('edit-mode');
                    alert('Data kapal berhasil dihapus dari database');
                } catch (error) {
                    console.error('Error deleting ship:', error);
                }
            }
        };
        modal.style.display = 'block';
    }
    function editMaintenance(index) {
        editingMaintenanceIndex = index;
        const item = maintenanceSchedules[index];
        if (maintenanceForm.elements['maintenance-type']) {
            maintenanceForm.elements['maintenance-type'].value = item.type || 'maintenance'; 
        }
        maintenanceForm.elements['startKd'].value = item.startKd;
        maintenanceForm.elements['endKd'].value = item.endKd;
        maintenanceForm.elements['startTime'].value = formatForInput(item.startTime);
        maintenanceForm.elements['endTime'].value = formatForInput(item.endTime);
        maintenanceForm.elements['keterangan'].value = item.keterangan;
        maintenanceModalTitle.textContent = 'Edit Maintenance';
        maintenanceSubmitBtn.textContent = 'Update';
        maintenanceForm.classList.add('edit-mode');
        deleteMaintenanceBtn.onclick = async () => {
            if (confirm('Anda yakin ingin menghapus data maintenance ini?')) {
                try {
                    const maintenanceId = maintenanceSchedules[editingMaintenanceIndex].id;
                    await apiDelete('maintenance', maintenanceId);
                    maintenanceSchedules.splice(editingMaintenanceIndex, 1);
                    updateDisplay();
                    maintenanceModal.style.display = 'none';
                    maintenanceForm.classList.remove('edit-mode');
                    alert('Data maintenance berhasil dihapus dari database');
                } catch (error) {
                    console.error('Error deleting maintenance:', error);
                }
            }
        };
        maintenanceModal.style.display = 'block';
    }
    function editRestTime(index) {
        editingRestIndex = index;
        const item = restSchedules[index];
        restForm.elements['startTime'].value = formatForInput(item.startTime);
        restForm.elements['endTime'].value = formatForInput(item.endTime);
        restForm.elements['keterangan'].value = item.keterangan;
        restModalTitle.textContent = 'Edit Waktu Istirahat';
        restSubmitBtn.textContent = 'Update';
        restForm.classList.add('edit-mode');
        deleteRestBtn.onclick = async () => {
            if (confirm('Anda yakin ingin menghapus waktu istirahat ini?')) {
                try {
                    const restId = restSchedules[editingRestIndex].id;
                    await apiDelete('rest', restId);
                    restSchedules.splice(editingRestIndex, 1);
                    updateDisplay();
                    restModal.style.display = 'none';
                    restForm.classList.remove('edit-mode');
                    alert('Data istirahat berhasil dihapus dari database');
                } catch (error) {
                    console.error('Error deleting rest:', error);
                }
            }
        };
        restModal.style.display = 'block';
    }

    async function exportToPDF(type = 'weekly') {
        console.log(`[PDF Export] Starting export process for type: ${type}`);
        const { jsPDF } = window.jspdf;
        const pdfHeader = document.getElementById('pdf-header');
        const pelindoLogoInHeader = pdfHeader.querySelector('.pdf-logo');
        const mainHeader = document.querySelector('.main-header');
        const berthMapContainer = document.getElementById('berth-map-container');
        const legendsScrollContainer = document.querySelector('.legends-scroll-container');
        const currentTimeIndicatorPDF = document.getElementById('current-time-indicator'); 
        const berthDividerLinePDF = document.getElementById('berth-divider-line');
        const exportBtn = document.getElementById('export-pdf-btn');
        const pdfOptions = document.getElementById('pdf-options');
        const gridScroll = document.querySelector('.grid-scroll-container');
        const yAxisColumn = document.querySelector('.y-axis-column');
        const gridContainer = document.querySelector('.grid-container');
        const legendsWrapper = document.querySelector('.bottom-legends-wrapper');

        // --- VALIDASI LOGO ---
        if (!pelindoLogoInHeader) {
            console.error("[PDF Export] ERROR: Elemen logo Pelindo tidak ditemukan!");
            alert("Error: Elemen logo Pelindo tidak ditemukan.");
            exportBtn.disabled = false;
            exportBtn.innerHTML = '<i class="fas fa-file-pdf"></i> PDF';
            return;
        }

        // --- UI UPDATE ---
        const originalBtnHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kompresi...'; // Feedback user
        pdfOptions.style.display = 'none';

        if (pelindoLogoInHeader) {
            pelindoLogoInHeader.crossOrigin = "anonymous";
        }

        mainHeader.classList.add('hide-for-pdf'); 
        
        // --- TEXT HACK (REST BLOCKS) ---
        const restBlocks = document.querySelectorAll('.rest-block');
        const originalRestBlockHTML = []; 
        restBlocks.forEach(block => {
            originalRestBlockHTML.push(block.innerHTML); 
            const text = block.textContent.trim();
            if (text) {
                const stackedText = text.split('').join('<br>'); 
                block.innerHTML = stackedText;
                block.classList.add('pdf-vertical-text-hack'); 
            }
        });

        // --- SIMPAN STATE ASLI ---
        const oldHeaderWidth = pdfHeader.style.width;
        const oldMapWidth = berthMapContainer.style.width;
        const oldLegendsWidth = legendsScrollContainer.style.width;
        const oldGridScrollOverflow = gridScroll.style.overflowX;
        const oldGridScrollLeft = gridScroll.scrollLeft;
        const oldLegendsScrollLeft = legendsScrollContainer.scrollLeft;
        const oldTimeIndicatorDisplay = currentTimeIndicatorPDF ? currentTimeIndicatorPDF.style.display : 'none';
        const oldDividerDisplay = berthDividerLinePDF ? berthDividerLinePDF.style.display : 'block';

        const oldYAxisPosition = yAxisColumn ? yAxisColumn.style.position : '';
        const oldYAxisLeft = yAxisColumn ? yAxisColumn.style.left : '';
        const oldYAxisZIndex = yAxisColumn ? yAxisColumn.style.zIndex : '';

        let targetScrollLeft = 0;

        try {
            let pdfFileName, pdfDateRangeStr;
            let captureWidth;
            let captureStartX = 0;

            const mapFullWidth = gridContainer.scrollWidth + (yAxisColumn ? yAxisColumn.offsetWidth : 0);
            const legendsFullWidth = legendsWrapper.scrollWidth;
            const fullWidth = Math.max(mapFullWidth, legendsFullWidth);

            const hourWidth = HOUR_WIDTH;
            const dayWidth = 24 * hourWidth;
            const yAxisWidth = yAxisColumn ? yAxisColumn.offsetWidth : 0;

            // --- LOGIKA DAILY VS WEEKLY ---
            if (type === 'daily') {
                let today = new Date(); today.setHours(0,0,0,0);
                let selectedDay = new Date(currentStartDate);
                let nextDay = new Date(selectedDay);
                nextDay.setDate(selectedDay.getDate() + 1);

                pdfDateRangeStr = `${formatDateForPDF(selectedDay)} to ${formatDateForPDF(nextDay)}`;
                pdfFileName = `Berth-Allocation-Harian-${selectedDay.toISOString().split('T')[0]}.pdf`;

                let dayDiff = 0; // Sesuaikan logic ini jika ingin pilih hari spesifik
                captureWidth = yAxisWidth + (2 * dayWidth); 
                targetScrollLeft = dayDiff * dayWidth; 
                captureStartX = targetScrollLeft; 

                gridScroll.style.overflowX = 'hidden';
                gridScroll.scrollLeft = targetScrollLeft;
                legendsScrollContainer.scrollLeft = 0;

            } else { 
                // WEEKLY
                let startDate = new Date(currentStartDate);
                let endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                pdfDateRangeStr = `${formatDate(startDate)} - ${formatDate(endDate)}`;

                pdfFileName = `Berth-Allocation-Mingguan-${startDate.toISOString().split('T')[0]}.pdf`;
                captureWidth = fullWidth;
                captureStartX = 0;
                targetScrollLeft = 0;
                
                gridScroll.style.overflowX = 'visible';
                gridScroll.scrollLeft = 0;
                legendsScrollContainer.scrollLeft = 0;
            }

            // --- SET LEBAR UNTUK CAPTURE ---
            pdfHeader.style.width = `${captureWidth}px`;
            berthMapContainer.style.width = `${captureWidth}px`;
            legendsScrollContainer.style.width = (type === 'daily' ? `${legendsFullWidth}px` : `${captureWidth}px`);
            
            const dateRangeEl = pdfHeader.querySelector('.pdf-date-range');
            if(dateRangeEl) dateRangeEl.textContent = pdfDateRangeStr;
            
            pdfHeader.style.display = 'flex'; 
            if(berthDividerLinePDF) berthDividerLinePDF.style.display = 'block';
            if(currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = 'block'; 

            if (type === 'weekly' && yAxisColumn) {
                yAxisColumn.style.position = 'relative'; 
                yAxisColumn.style.left = 'auto';
                yAxisColumn.style.zIndex = '18';
            }

            await new Promise(resolve => setTimeout(resolve, 800)); // Delay agar rendering CSS selesai

            // --- KONFIGURASI HTML2CANVAS OPTIMAL (UKURAN KECIL) ---
            // Scale 1 (Default) cukup untuk PDF A4/A3, Scale 2 membuat file sangat besar.
            const scale = 1; 
            
            const commonOptions = {
                scale: scale,
                useCORS: true,
                logging: false, // Matikan log biar cepat
                backgroundColor: '#ffffff' // PENTING: JPEG butuh background putih
            };

            const optionsBerthMap = {
                ...commonOptions,
                width: captureWidth, 
                height: berthMapContainer.scrollHeight,
                x: 0, 
            };

            const optionsLegends = {
                ...commonOptions,
                width: (type === 'daily' ? legendsFullWidth : captureWidth),
                height: legendsScrollContainer.scrollHeight,
                x: 0, 
            };
            const optionsHeader = { 
                ...commonOptions, 
                width: captureWidth, 
                height: pdfHeader.offsetHeight, 
                x: 0 
            };

            // --- CAPTURE ---
            const canvasHeader = await html2canvas(pdfHeader, optionsHeader);
            const canvasMapCombined = await html2canvas(berthMapContainer, optionsBerthMap);
            const canvasLegends = await html2canvas(legendsScrollContainer, optionsLegends);

            const canvases = [canvasHeader, canvasMapCombined, canvasLegends];
            
            // Hitung Ukuran PDF
            // 96 DPI adalah standar web. 25.4 mm = 1 inch
            const pdfWidthMM = (canvasMapCombined.width / scale / 96) * 25.4; 
            const totalPdfHeightMM = canvases.reduce((sum, c) => sum + (c.height / scale / 96) * 25.4, 0);

            const doc = new jsPDF({
                orientation: pdfWidthMM > totalPdfHeightMM ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidthMM, totalPdfHeightMM],
                compress: true // Aktifkan kompresi internal jsPDF
            });

            let yOffset = 0;
            for (const canvas of canvases) {
                // --- PENTING: UBAH KE JPEG UNTUK UKURAN KECIL ---
                // Format: 'image/jpeg', Quality: 0.75 (75%)
                const imgData = canvas.toDataURL('image/jpeg', 0.75); 
                
                const imgHeightMM = (canvas.height / scale / 96) * 25.4;
                const imgWidthMM = (canvas.width / scale / 96) * 25.4;
                
                // Parameter 'FAST' mempercepat kompresi dan mengurangi ukuran
                doc.addImage(imgData, 'JPEG', 0, yOffset, imgWidthMM, imgHeightMM, undefined, 'FAST');
                yOffset += imgHeightMM;
            }

            doc.save(pdfFileName);

        } catch (error) {
            console.error("[PDF Export] Error:", error);
            alert("Terjadi kesalahan saat membuat file PDF.");
        } finally {
            // --- CLEANUP (KEMBALIKAN TAMPILAN) ---
            mainHeader.classList.remove('hide-for-pdf');

            restBlocks.forEach((block, index) => {
                if (originalRestBlockHTML[index] !== undefined) {
                    block.innerHTML = originalRestBlockHTML[index]; 
                }
                block.classList.remove('pdf-vertical-text-hack'); 
            });

            pdfHeader.style.display = 'none'; 
            pdfHeader.style.width = oldHeaderWidth;
            berthMapContainer.style.width = oldMapWidth;
            legendsScrollContainer.style.width = oldLegendsWidth;
            gridScroll.style.overflowX = oldGridScrollOverflow;
            gridScroll.scrollLeft = oldGridScrollLeft;
            legendsScrollContainer.scrollLeft = oldLegendsScrollLeft;
            
            if(currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = oldTimeIndicatorDisplay; 
            if(berthDividerLinePDF) berthDividerLinePDF.style.display = oldDividerDisplay; 

            if (yAxisColumn) {
                yAxisColumn.style.position = oldYAxisPosition;
                yAxisColumn.style.left = oldYAxisLeft;
                yAxisColumn.style.zIndex = oldYAxisZIndex;
            }

            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnHTML;
        }
    }

    function setupEventListeners() {
        console.log('🟢 setupEventListeners() STARTED');
        console.log('📋 shipForm element:', shipForm);
        console.log('📋 shipForm.elements:', shipForm?.elements?.length, 'elements found');
        
        // Communication Log buttons
        const saveCommLogBtn = document.getElementById('save-comm-log-btn');
        const clearCommLogBtn = document.getElementById('clear-comm-log-btn');
        
        if (saveCommLogBtn) {
            saveCommLogBtn.addEventListener('click', async () => {
                const success = await saveCommLog();
                if (success) {
                    alert('✅ Communication Log berhasil disimpan ke database!');
                }
            });
        }
        
        if (clearCommLogBtn) {
            clearCommLogBtn.addEventListener('click', async () => {
                if (confirm('Anda yakin ingin menghapus semua isi Communication Log?')) {
                    const table = document.getElementById('comm-log-table');
                    const rows = table.querySelectorAll('tbody tr');
                    
                    rows.forEach(row => {
                        // Clear datetime input
                        const datetimeInput = row.querySelector('input[type="datetime-local"]');
                        if (datetimeInput) {
                            datetimeInput.value = '';
                        }

                        // Clear contenteditable cells (except Comm Channel)
                        const contentEditableCells = row.querySelectorAll('td[contenteditable="true"]');
                        contentEditableCells.forEach((cell, idx) => {
                            if (idx < contentEditableCells.length - 1) {
                                cell.textContent = '';
                            } else {
                                cell.textContent = 'WAG';
                            }
                        });
                    });
                    
                    // Save to database (empty data)
                    await saveCommLog();
                    alert('✅ Communication Log berhasil dihapus!');
                }
            });
        }

        // Setup delete row buttons for communication log
        setupCommLogDeleteButtons();
        
        prevWeekBtn.addEventListener('click', () => { currentStartDate.setDate(currentStartDate.getDate() - 7); updateDisplay(); });
        nextWeekBtn.addEventListener('click', () => { currentStartDate.setDate(currentStartDate.getDate() + 7); updateDisplay(); });


        weekDatePicker.addEventListener('change', () => {
            const selectedDate = weekDatePicker.value;
            if (!selectedDate) {
                currentStartDate = getStartOfWeek(new Date()); 
            } else {
                const parts = selectedDate.split('-'); 
                currentStartDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
            updateDisplay(); 
        });

        addShipBtn.addEventListener('click', () => {
            editingShipIndex = null;
            shipForm.reset();
            loadPendingForm();
            modalTitle.textContent = 'Tambah Jadwal Kapal';
            formSubmitBtn.textContent = 'Submit';
            shipForm.classList.remove('edit-mode');
            deleteShipBtn.onclick = null;
            // Trigger calculations terutama untuk readonly fields yang kosong
            setTimeout(() => {
                calculateEndKdAndMean();
                calculateEtcAndEtd();
            }, 100);
            modal.style.display = 'block';
        });
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            shipForm.classList.remove('edit-mode');
        });

        const pdfDropdownBtn = document.getElementById('export-pdf-btn');
        const pdfOptionsContainer = document.getElementById('pdf-options');
        const pdfOptionBtns = document.querySelectorAll('.pdf-option-btn');

        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
                shipForm.classList.remove('edit-mode');
            }
            if (event.target == maintenanceModal) {
                maintenanceModal.style.display = 'none';
                maintenanceForm.classList.remove('edit-mode');
            }
            if (event.target == restModal) {
                restModal.style.display = 'none';
                restForm.classList.remove('edit-mode');
            }

            if (pdfOptionsContainer.style.display === 'block' && !pdfDropdownBtn.contains(event.target)) {
                pdfOptionsContainer.style.display = 'none';
            }
        });

        // ===== AUTO-CALCULATION LOGIC UNTUK FORM SHIP =====
        
        // Function untuk auto-calculate End KD dan Mean berdasarkan Start KD dan Length
        function calculateEndKdAndMean() {
            try {
                const startKdInput = document.getElementById('start-kd');
                const lengthInput = document.getElementById('ship-length');
                const endKdInput = document.getElementById('n-kd');
                const meanInput = document.getElementById('min-kd');
                
                const startKd = parseFloat(startKdInput.value) || 0;
                const length = parseFloat(lengthInput.value) || 0;
                
                console.log('calculateEndKdAndMean: startKd=', startKd, 'length=', length);
                
                if (startKd > 0 && length > 0) {
                    const endKd = startKd + length;
                    const mean = (startKd + endKd) / 2;
                    
                    endKdInput.value = endKd.toFixed(1);
                    meanInput.value = mean.toFixed(1);
                } else {
                    // Kosongkan jika input tidak valid
                    if (!endKdInput.value) endKdInput.value = '';
                    if (!meanInput.value) meanInput.value = '';
                }
            } catch (error) {
                console.error('Error in calculateEndKdAndMean:', error);
            }
        }
        
        // Function untuk auto-calculate ETC dan ETD berdasarkan ETB, Discharge, Loading, dan BSH
        function calculateEtcAndEtd() {
            try {
                const startTimeInput = document.getElementById('start-time');
                const dischargeInput = document.getElementById('discharge-value');
                const loadingInput = document.getElementById('load-value');
                const bshInput = document.getElementById('ship-bsh');
                const etcInput = document.getElementById('etc-time');
                const etdInput = document.getElementById('end-time');
                
                const startTime = startTimeInput.value; // Format: "YYYY-MM-DDTHH:mm"
                const discharge = parseFloat(dischargeInput.value) || 0;
                const loading = parseFloat(loadingInput.value) || 0;
                const bsh = parseFloat(bshInput.value) || 0;
                
                if (!startTime || bsh <= 0) {
                    return; // Jangan hitung jika data belum lengkap
                }
                
                // Parse datetime-local string sebagai waktu lokal
                const [datePart, timePart] = startTime.split('T');
                if (!datePart || !timePart) return;
                
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = timePart.split(':').map(Number);
                
                // Validasi parsing
                if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
                    return;
                }
                
                // Buat date object dengan waktu lokal
                const etbDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                
                // Hitung ETD = ETB + ((Discharge + Loading) / BSH) jam
                const workingHours = (discharge + loading) / bsh;
                const etdDate = new Date(etbDate.getTime()); // Clone date
                const etdTotalMinutes = etdDate.getHours() * 60 + etdDate.getMinutes() + (workingHours * 60);
                etdDate.setHours(0, 0, 0, 0); // Reset ke 00:00
                etdDate.setMinutes(etdDate.getMinutes() + etdTotalMinutes);
                
                // Format ETD ke datetime-local format
                const formatDateTime = (date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const h = String(date.getHours()).padStart(2, '0');
                    const min = String(date.getMinutes()).padStart(2, '0');
                    return `${y}-${m}-${d}T${h}:${min}`;
                };
                
                etdInput.value = formatDateTime(etdDate);
                
                // Hitung ETC = ETD - 1 jam
                const etcDate = new Date(etdDate.getTime()); // Clone ETD date
                etcDate.setHours(etcDate.getHours() - 1);
                
                etcInput.value = formatDateTime(etcDate);
            } catch (error) {
                console.error('Error calculating ETC/ETD:', error);
            }
        }
        
        // Event listeners untuk auto-calculate End KD dan Mean
        document.getElementById('start-kd').addEventListener('input', calculateEndKdAndMean);
        document.getElementById('ship-length').addEventListener('input', calculateEndKdAndMean);
        
        // Event listeners untuk auto-calculate ETC dan ETD
        document.getElementById('start-time').addEventListener('input', calculateEtcAndEtd);
        document.getElementById('discharge-value').addEventListener('input', calculateEtcAndEtd);
        document.getElementById('load-value').addEventListener('input', calculateEtcAndEtd);
        document.getElementById('ship-bsh').addEventListener('input', calculateEtcAndEtd);

        shipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔴 FORM SUBMIT EVENT FIRED!');
            
            try {
                // Trigger calculations PERTAMA KALI
                calculateEndKdAndMean();
                calculateEtcAndEtd();
                
                // Tunggu calculation selesai
                await new Promise(resolve => setTimeout(resolve, 100));
                
                console.log('📝 Starting validation...');
                
                // Ambil nilai dari form elements dengan cara yang lebih reliable
                const shipName = (document.getElementById('ship-name')?.value || '').trim();
                const company = (document.getElementById('ship-company')?.value || '').trim();
                const code = (document.getElementById('ship-code')?.value || '').trim();
                const destPort = (document.getElementById('dest-port')?.value || '').trim();
                const startKd = (document.getElementById('start-kd')?.value || '').trim();
                const length = (document.getElementById('ship-length')?.value || '').trim();
                const draft = (document.getElementById('ship-draft')?.value || '').trim();
                const etaTime = document.getElementById('eta-time')?.value || '';
                const startTime = document.getElementById('start-time')?.value || '';
                const status = document.getElementById('ship-status')?.value || '';
                const berthSide = document.getElementById('ship-berth-side')?.value || '';
                
                console.log('Values:', { shipName, company, code, startKd, length, draft, etaTime, startTime });
                
                // Validasi SIMPLE - Hanya check required fields
                if (!shipName) {
                    alert("❌ Nama kapal kosong!");
                    return;
                }
                if (!company) {
                    alert("❌ Perusahaan pelayaran kosong!");
                    return;
                }
                if (!code) {
                    alert("❌ Kode kapal kosong!");
                    return;
                }
                if (!length) {
                    alert("❌ Panjang kapal kosong! (Silakan isi dengan angka)");
                    document.getElementById('ship-length').focus();
                    return;
                }
                if (!draft) {
                    alert("❌ Draft kapal kosong!");
                    return;
                }
                if (!startKd) {
                    alert("❌ Start KD kosong!");
                    return;
                }
                if (!etaTime) {
                    alert("❌ Waktu ETA kosong!");
                    return;
                }
                if (!startTime) {
                    alert("❌ Waktu ETB kosong!");
                    return;
                }
                if (!status) {
                    alert("❌ Status kapal belum dipilih!");
                    return;
                }
                if (!berthSide) {
                    alert("❌ Berth side belum dipilih!");
                    return;
                }
                
                console.log('✅ Validation passed!');
                
                // Prepare data
                const formData = new FormData(shipForm);
                const shipData = Object.fromEntries(formData.entries());
                
                shipData.length = parseInt(shipData.length, 10) || 0;
                shipData.draft = parseFloat(shipData.draft) || 0;
                shipData.startKd = parseInt(shipData.startKd, 10) || 0;
                shipData.nKd = parseInt(shipData.nKd, 10) || 0;
                shipData.minKd = parseInt(shipData.minKd, 10) || 0;
                shipData.bsh = parseInt(shipData.bsh, 10) || 0;
                shipData.loadValue = parseInt(shipData.loadValue, 10) || 0;
                shipData.dischargeValue = parseInt(shipData.dischargeValue, 10) || 0;
                
                const qccCheckboxes = document.querySelectorAll('#qcc-checkbox-group input[type="checkbox"]:checked');
                const checkedQCCs = Array.from(qccCheckboxes).map(cb => cb.value);
                shipData.qccName = checkedQCCs.join(' & ');
                
                console.log('📦 Ship data prepared:', shipData);

                try {
                    let result;
                    if (editingShipIndex !== null) {
                        // UPDATE
                        shipData.id = shipSchedules[editingShipIndex].id;
                        console.log('🔄 Calling UPDATE with ID:', shipData.id);
                        result = await apiCall('update_ship.php', 'POST', shipData);
                        console.log('✅ UPDATE result:', result);
                        shipSchedules[editingShipIndex] = shipData;
                    } else {
                        // CREATE NEW
                        console.log('➕ Calling SAVE (NEW)');
                        result = await apiCall('save_ship.php', 'POST', shipData);
                        console.log('✅ SAVE result:', result);
                        shipSchedules.unshift(shipData);
                    }
                    
                    // SUCCESS
                    updateDisplay();
                    modal.style.display = 'none';
                    shipForm.classList.remove('edit-mode');
                    clearPendingForm();
                    alert('✅ Data kapal berhasil disimpan!');
                } catch (apiError) {
                    console.error('❌ API Error:', apiError);
                    alert('❌ Error API: ' + apiError.message);
                }
            } catch (error) {
                console.error('❌ Form Submit Error:', error);
                alert('❌ Form Error: ' + error.message);
            }
        });

        Array.from(shipForm.elements).forEach(input => {
            input.addEventListener('input', savePendingForm);
        });

        addMaintenanceBtn.addEventListener('click', () => {
            editingMaintenanceIndex = null;
            maintenanceForm.reset();
            maintenanceModalTitle.textContent = 'Tambah Maintenance';
            maintenanceSubmitBtn.textContent = 'Submit';
            maintenanceForm.classList.remove('edit-mode');
            deleteMaintenanceBtn.onclick = null;
            maintenanceModal.style.display = 'block';
        });
        maintenanceCloseBtn.addEventListener('click', () => {
            maintenanceModal.style.display = 'none';
            maintenanceForm.classList.remove('edit-mode');
        });
        maintenanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startTime = maintenanceForm.elements['startTime'].value;
            const endTime = maintenanceForm.elements['endTime'].value;
            if (new Date(endTime) <= new Date(startTime)) {
                alert("Waktu Selesai harus setelah Waktu Mulai.");
                return;
            }

            const formData = new FormData(maintenanceForm);
            const data = Object.fromEntries(formData.entries());
            data.startKd = parseInt(data.startKd, 10);
            data.endKd = parseInt(data.endKd, 10); 

            if (data.endKd <= data.startKd) {
                alert("End KD harus lebih besar dari Start KD.");
                return;
            }

            try {
                if (editingMaintenanceIndex !== null) {
                    // Update existing maintenance
                    data.id = maintenanceSchedules[editingMaintenanceIndex].id;
                    await apiCall('save_maintenance.php', 'POST', data);
                    maintenanceSchedules[editingMaintenanceIndex] = data;
                } else {
                    // Create new maintenance
                    await apiCall('save_maintenance.php', 'POST', data);
                    maintenanceSchedules.push(data);
                }
                updateDisplay();
                maintenanceModal.style.display = 'none';
                maintenanceForm.classList.remove('edit-mode');
                alert('Data maintenance berhasil disimpan ke database');
            } catch (error) {
                console.error('Error saving maintenance:', error);
            }
        });

        addRestBtn.addEventListener('click', () => {
            editingRestIndex = null;
            restForm.reset();
            restModalTitle.textContent = 'Tambah Waktu Istirahat';
            restSubmitBtn.textContent = 'Submit';
            restForm.classList.remove('edit-mode');
            deleteRestBtn.onclick = null;
            restModal.style.display = 'block';
        });
        restCloseBtn.addEventListener('click', () => {
            restModal.style.display = 'none';
            restForm.classList.remove('edit-mode');
        });
        restForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startTime = restForm.elements['startTime'].value;
            const endTime = restForm.elements['endTime'].value;
            if (new Date(endTime) <= new Date(startTime)) {
                alert("Waktu Selesai harus setelah Waktu Mulai.");
                return;
            }
            const formData = new FormData(restForm);
            const data = Object.fromEntries(formData.entries());
            
            try {
                if (editingRestIndex !== null) {
                    // Update existing rest
                    data.id = restSchedules[editingRestIndex].id;
                    await apiCall('save_break.php', 'POST', data);
                    restSchedules[editingRestIndex] = data;
                } else {
                    // Create new rest
                    await apiCall('save_break.php', 'POST', data);
                    restSchedules.push(data);
                }
                updateDisplay();
                restModal.style.display = 'none';
                restForm.classList.remove('edit-mode');
                alert('Data istirahat berhasil disimpan ke database');
            } catch (error) {
                console.error('Error saving rest:', error);
            }
        });

        const commLogCells = document.querySelectorAll('#comm-log-table td[contenteditable="true"]');
        commLogCells.forEach(cell => {
            cell.addEventListener('input', saveCommLog);
        });

        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', async () => {
                if (confirm('Anda yakin ingin menghapus semua data jadwal kapal, maintenance, istirahat dan communication log?')) {
                    try {
                        // Hapus records kapal satu per satu dari database
                        for (let ship of shipSchedules) {
                            if (ship.id) {
                                await apiDelete('ship', ship.id);
                            }
                        }
                        
                        // Hapus records maintenance satu per satu dari database
                        for (let item of maintenanceSchedules) {
                            if (item.id) {
                                await apiDelete('maintenance', item.id);
                            }
                        }
                        
                        // Hapus records rest satu per satu dari database
                        for (let item of restSchedules) {
                            if (item.id) {
                                await apiDelete('rest', item.id);
                            }
                        }
                        
                        shipSchedules = [];
                        maintenanceSchedules = [];
                        restSchedules = [];

                        localStorage.removeItem('communicationLogData');
                        localStorage.removeItem('draggableLinePosition'); 

                        clearPendingForm();

                        document.querySelectorAll('#comm-log-table tbody tr').forEach(row => {
                            const cells = row.querySelectorAll('td[contenteditable="true"]');
                            cells.forEach((cell, index) => {
                                if (index === cells.length - 1) {
                                   cell.textContent = 'WAG';
                                } else {
                                     cell.textContent = '';
                                }
                            });
                        });

                        draggableLineLeft = 200; 
                        updateDisplay();
                        alert('Semua data berhasil dihapus dari database');
                    } catch (error) {
                        console.error('Error clearing data:', error);
                    }
                }
            });
        }

        pdfDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const isVisible = pdfOptionsContainer.style.display === 'block';
            pdfOptionsContainer.style.display = isVisible ? 'none' : 'block';
        });

        pdfOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = e.target.dataset.type; 
                exportToPDF(type); 
            });
        });

        let activeDraggableLine = null;

        
        grid.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('draggable-cc-line')) {
                activeDraggableLine = e.target;
                e.preventDefault(); 
            }
        });

    
        document.addEventListener('mousemove', (e) => {
            if (!activeDraggableLine) return; 

            e.preventDefault(); 
            
            const containerRect = grid.getBoundingClientRect();
            
            let newTop = e.clientY - containerRect.top;

            const minTop = 0;
            const maxTop = grid.clientHeight - activeDraggableLine.offsetHeight; 
            
            if (newTop < minTop) newTop = minTop;
            if (newTop > maxTop) newTop = maxTop;

            activeDraggableLine.style.top = `${newTop}px`;
        });
        document.addEventListener('mouseup', () => {
            activeDraggableLine = null; 
        });
        
        console.log('✅ setupEventListeners() COMPLETE - all event listeners attached!');
    } 
    
    initialize();

});
