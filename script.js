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
    const API_BASE_URL = 'http://localhost/ba_map_app'; // Backend API URL (PHP)

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

            const masterShip = masterShips.find(s => (s.ship_name || '').toLowerCase() === (ship.shipName || '').toLowerCase());
            const codeParts = [];
            if (ship.code) codeParts.push(ship.code);
            if (ship.voyage) codeParts.push(ship.voyage);
            if (masterShip && masterShip.year) codeParts.push(masterShip.year);
            if (masterShip && masterShip.window) codeParts.push(masterShip.window);
            const wsCodeValue = ship.wsCode || ship.ws_code || '';
            const baseDetails = codeParts.length ? codeParts.join(' / ') : 'N/A';
            const codeDetails = wsCodeValue ? `${baseDetails} ${wsCodeValue}` : baseDetails;

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
                            <span class="ship-sub-title">${codeDetails}</span>
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
                    petugas: contentEditableCells[0].textContent.trim(),
                    stakeholder: contentEditableCells[1].textContent.trim(),
                    pic: contentEditableCells[2].textContent.trim(),
                    remark: contentEditableCells[3].textContent.trim(),
                    commChannel: contentEditableCells[4].textContent.trim(),
                };
                
                // Hanya push jika baris benar-benar ada isinya (tidak semua field kosong)
                if (rowData.dateTime || rowData.petugas || rowData.stakeholder || rowData.pic || rowData.remark) {
                    data.push(rowData);
                }
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

    // ============= COMMUNICATION LOG FUNCTIONS (DYNAMIC ROWS) =============
    
    // Fungsi untuk menambah baris baru di communication log
    function addCommLogRow(data = null) {
        const table = document.getElementById('comm-log-table');
        const tbody = table.querySelector('tbody');
        const rowCount = tbody.querySelectorAll('tr').length;
        const rowNumber = rowCount + 1;

        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${rowNumber}</td>
            <td><input type="datetime-local" class="comm-datetime-input"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true"></td>
            <td contenteditable="true">WAG</td>
            <td style="text-align: center;"><button type="button" class="btn-delete-row" style="padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>
        `;

        // Jika ada data, isi baris dengan data tersebut
        if (data) {
            newRow.setAttribute('data-id', data.id);
            
            const datetimeInput = newRow.querySelector('input[type="datetime-local"]');
            if (datetimeInput && data.dateTime) {
                const dateTimePart = data.dateTime.split(' ');
                if (dateTimePart.length >= 2) {
                    const datePart = dateTimePart[0];
                    const timePart = dateTimePart[1].substring(0, 5);
                    datetimeInput.value = datePart + 'T' + timePart;
                }
            }

            const contentEditableCells = newRow.querySelectorAll('td[contenteditable="true"]');
            if (contentEditableCells.length >= 5) {
                contentEditableCells[0].textContent = data.petugas || '';
                contentEditableCells[1].textContent = data.stakeholder || '';
                contentEditableCells[2].textContent = data.pic || '';
                contentEditableCells[3].textContent = data.remark || '';
                contentEditableCells[4].textContent = data.commChannel || 'WAG';
            }
        }

        tbody.appendChild(newRow);
        
        // Setup delete button untuk baris baru
        const deleteBtn = newRow.querySelector('.btn-delete-row');
        setupSingleDeleteButton(deleteBtn);
        
        // Setup auto-add listener untuk baris baru
        setupRowAutoAdd(newRow);
        
        return newRow;
    }

    // Update nomor urut semua baris
    function updateCommLogRowNumbers() {
        const table = document.getElementById('comm-log-table');
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.querySelector('td:first-child').textContent = index + 1;
        });
    }

    // Setup listener untuk auto-add baris baru ketika user mulai mengisi
    function setupRowAutoAdd(row) {
        const datetimeInput = row.querySelector('input[type="datetime-local"]');
        const editableCells = row.querySelectorAll('td[contenteditable="true"]');

        const checkAndAddRow = () => {
            const table = document.getElementById('comm-log-table');
            const tbody = table.querySelector('tbody');
            const lastRow = tbody.querySelector('tr:last-child');
            
            // Jika baris ini adalah baris terakhir dan mulai diisi, tambah baris baru
            if (row === lastRow) {
                const hasContent = datetimeInput.value || 
                    Array.from(editableCells).some(cell => cell.textContent.trim() && cell.textContent.trim() !== 'WAG');
                
                if (hasContent) {
                    // Cek apakah sudah ada baris kosong berikutnya
                    const nextRow = row.nextElementSibling;
                    if (!nextRow) {
                        console.log('➕ Auto-adding new row');
                        addCommLogRow();
                    }
                }
            }
        };

        datetimeInput.addEventListener('change', checkAndAddRow);
        editableCells.forEach(cell => {
            cell.addEventListener('input', checkAndAddRow);
        });
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
                // Tetap tambahkan 1 baris kosong jika error
                addCommLogRow();
                return;
            }

            const table = document.getElementById('comm-log-table');
            const tbody = table.querySelector('tbody');
            
            // Clear existing rows
            tbody.innerHTML = '';

            if (result.status === 'success' && result.data && result.data.length > 0) {
                const data = result.data;
                console.log('✅ Loaded', data.length, 'communication log entries');

                // Tambahkan baris untuk setiap data
                data.forEach(item => {
                    addCommLogRow(item);
                });
            }
            
            // Selalu tambahkan 1 baris kosong di akhir untuk input baru
            addCommLogRow();

            console.log('✅ Communication log loaded from database');
        } catch (error) {
            console.error('❌ Error loading communication log:', error);
            // Tetap tambahkan 1 baris kosong jika error
            addCommLogRow();
        }
    }

    // Setup delete button untuk satu tombol (digunakan saat menambah baris baru)
    function setupSingleDeleteButton(btn) {
        btn.addEventListener('click', async () => {
            const row = btn.closest('tr');
            const rowId = row.getAttribute('data-id');
            const table = document.getElementById('comm-log-table');
            const tbody = table.querySelector('tbody');
            const rowCount = tbody.querySelectorAll('tr').length;

            // Jangan hapus jika hanya tersisa 1 baris
            if (rowCount === 1) {
                // Clear isi baris saja
                const datetimeInput = row.querySelector('input[type="datetime-local"]');
                if (datetimeInput) datetimeInput.value = '';
                
                const contentEditableCells = row.querySelectorAll('td[contenteditable="true"]');
                contentEditableCells.forEach((cell, idx) => {
                    if (idx < contentEditableCells.length - 1) {
                        cell.textContent = '';
                    } else {
                        cell.textContent = 'WAG';
                    }
                });
                
                row.removeAttribute('data-id');
                console.log('🗑️ Row cleared (last row)');
                return;
            }

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

                    // Remove the row from UI
                    row.remove();
                    
                    // Update nomor urut
                    updateCommLogRowNumbers();
                    
                    console.log('🗑️ Row deleted and removed');
                    alert('✅ Baris komunikasi log berhasil dihapus!');
                } catch (error) {
                    console.error('❌ Error deleting row:', error);
                    alert('❌ Error: ' + error.message);
                }
            }
        });
    }

    function setupCommLogDeleteButtons() {
        const table = document.getElementById('comm-log-table');
        const deleteButtons = table.querySelectorAll('.btn-delete-row');

        deleteButtons.forEach(btn => {
            // Remove old listeners (jika ada) dengan clone & replace
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Setup listener baru
            setupSingleDeleteButton(newBtn);
        });
    }

    // ============= MASTER SHIPS FUNCTIONS =============
    let masterShips = [];
    let editingMasterShipId = null;

    async function loadMasterShips() {
        try {
            const response = await fetch('get_master_ships.php');
            const result = await response.json();
            
            if (result.status === 'success') {
                masterShips = result.data || [];
                console.log('✅ Loaded', masterShips.length, 'master ships');
                updateMasterShipsTable();
                updateShipNameDatalist();
                return true;
            } else {
                console.error('❌ Failed to load master ships:', result.message);
                masterShips = [];
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading master ships:', error);
            masterShips = [];
            return false;
        }
    }

    function updateMasterShipsTable() {
        const tbody = document.querySelector('#master-ships-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (masterShips.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">Belum ada data kapal</td></tr>';
            return;
        }

        masterShips.forEach((ship, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${index + 1}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${ship.ship_name || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${ship.shipping_line || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${ship.ship_code || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${ship.length || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${ship.draft || '-'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
                    <button class="btn btn-sm" onclick="editMasterShip(${ship.id})" style="padding: 5px 10px; margin-right: 5px; background: #007bff; color: white;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm" onclick="deleteMasterShip(${ship.id})" style="padding: 5px 10px; background: #dc3545; color: white;">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    function updateShipNameDatalist() {
        const datalist = document.getElementById('ship-name-suggestions');
        if (!datalist) return;

        datalist.innerHTML = '';
        masterShips.forEach(ship => {
            const option = document.createElement('option');
            option.value = ship.ship_name;
            datalist.appendChild(option);
        });
    }

    async function saveMasterShip(formData) {
        try {
            const response = await fetch('save_master_ship.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ Master ship saved successfully');
                await loadMasterShips();
                return true;
            } else {
                console.error('❌ Failed to save master ship:', result.message);
                alert('❌ Gagal menyimpan: ' + result.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Error saving master ship:', error);
            alert('❌ Error: ' + error.message);
            return false;
        }
    }

    window.editMasterShip = function(id) {
        const ship = masterShips.find(s => s.id == id);
        if (!ship) return;

        editingMasterShipId = id;
        
        // Fill form
        document.getElementById('master-ship-id').value = ship.id;
        document.getElementById('master-ship-name').value = ship.ship_name || '';
        document.getElementById('master-shipping-line').value = ship.shipping_line || '';
        document.getElementById('master-ship-code').value = ship.ship_code || '';
        document.getElementById('master-year').value = ship.year || '';
        document.getElementById('master-window').value = ship.window || '';
        document.getElementById('master-length').value = ship.length || '';
        document.getElementById('master-draft').value = ship.draft || '';
        document.getElementById('master-destination-port').value = ship.destination_port || '';
        document.getElementById('master-next-port').value = ship.next_port || '';

        document.getElementById('master-ship-form-title').textContent = 'Edit Data Kapal';
        document.getElementById('master-ship-form-container').style.display = 'block';
    };

    window.deleteMasterShip = async function(id) {
        if (!confirm('Anda yakin ingin menghapus data kapal ini?')) return;

        try {
            const response = await fetch(`delete_data.php?id=${id}&type=master_ship`);
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ Master ship deleted successfully');
                alert('✅ Data kapal berhasil dihapus!');
                await loadMasterShips();
            } else {
                alert('❌ Gagal menghapus: ' + result.message);
            }
        } catch (error) {
            console.error('❌ Error deleting master ship:', error);
            alert('❌ Error: ' + error.message);
        }
    };

    function autoFillShipDataFromMaster(shipName) {
        const ship = masterShips.find(s => s.ship_name.toLowerCase() === shipName.toLowerCase());
        if (!ship) return;

        console.log('🔄 Auto-filling ship data from master:', shipName);

        // Auto-fill fields
        if (ship.shipping_line) {
            const companySelect = document.getElementById('ship-company');
            companySelect.value = ship.shipping_line;
        }
        if (ship.ship_code) document.getElementById('ship-code').value = ship.ship_code;
        if (ship.length) document.getElementById('ship-length').value = ship.length;
        if (ship.draft) document.getElementById('ship-draft').value = ship.draft;
        
        // Combine destination_port and next_port for dest-port field
        let destPortValue = '';
        if (ship.destination_port) destPortValue += ship.destination_port;
        if (ship.next_port) {
            if (destPortValue) destPortValue += ' / ';
            destPortValue += ship.next_port;
        }
        if (destPortValue) document.getElementById('dest-port').value = destPortValue;

        console.log('✅ Ship data auto-filled');
        
        // Trigger calculation untuk end KD dan mean
        setTimeout(() => {
            const calculateEndKdAndMean = window.calculateEndKdAndMean;
            if (typeof calculateEndKdAndMean === 'function') {
                calculateEndKdAndMean();
            }
        }, 100);
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
        await loadMasterShips();
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
            document.getElementById('ship-voyage').value = ship.voyage || '';
            document.getElementById('ship-ws-code').value = ship.wsCode || ship.ws_code || '';
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
        restModal.style.display = 'none';
    }

    async function exportMonthlyPDF() {
        const exportBtn = document.getElementById('export-pdf-btn');
        const originalBtnHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generate...';
        
        const pdfHeader = document.getElementById('pdf-header');
        const pelindoLogoInHeader = pdfHeader.querySelector('.pdf-logo');
        const mainHeader = document.querySelector('.main-header');
        const berthMapContainer = document.getElementById('berth-map-container');
        const legendsScrollContainer = document.querySelector('.legends-scroll-container');
        const currentTimeIndicatorPDF = document.getElementById('current-time-indicator');
        const berthDividerLinePDF = document.getElementById('berth-divider-line');
        const gridScroll = document.querySelector('.grid-scroll-container');
        const gridContainer = document.querySelector('.grid-container');
        const yAxisColumn = document.querySelector('.y-axis-column');
        const legendsWrapper = document.querySelector('.bottom-legends-wrapper');
        
        try {
            // IMPORTANT: Always export FULL month (1st to last day)
            let startDate = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), 1);
            let endDate = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth() + 1, 0);
            
            const filename = `Berth-Allocation-Bulanan-${startDate.toISOString().split('T')[0]}.pdf`;
            
            console.log(`[Monthly PDF] Exporting FULL MONTH: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
            
            // Save original date
            const originalStartDate = new Date(currentStartDate);
            
            // Generate weeks array (include partial weeks)
            const weeks = [];
            let weekStart = new Date(startDate);
            while (weekStart <= endDate) {
                let weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                
                // Include semua minggu, termasuk yang partial di akhir
                if (weekEnd > endDate) {
                    weekEnd = new Date(endDate);
                }
                
                weeks.push({
                    start: new Date(weekStart),
                    end: new Date(weekEnd)
                });
                
                weekStart.setDate(weekStart.getDate() + 7);
            }
            
            console.log(`[Monthly PDF] Total weeks to export: ${weeks.length}`);
            
            // Prepare UI for PDF - same as weekly export
            mainHeader.classList.add('hide-for-pdf');
            
            if (pelindoLogoInHeader) {
                pelindoLogoInHeader.crossOrigin = "anonymous";
            }
            
            // Save original states
            const oldGridScrollOverflow = gridScroll.style.overflowX;
            const oldGridScrollLeft = gridScroll.scrollLeft;
            const oldLegendsScrollLeft = legendsScrollContainer.scrollLeft;
            const oldTimeIndicatorDisplay = currentTimeIndicatorPDF ? currentTimeIndicatorPDF.style.display : 'none';
            const oldDividerDisplay = berthDividerLinePDF ? berthDividerLinePDF.style.display : 'block';
            
            // Hide time indicators
            if (currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = 'none';
            if (berthDividerLinePDF) berthDividerLinePDF.style.display = 'none';
            
            // Set grid to show full width (like weekly)
            gridScroll.style.overflowX = 'visible';
            gridScroll.scrollLeft = 0;
            legendsScrollContainer.scrollLeft = 0;
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            let isFirstPage = true;
            
            for (let i = 0; i < weeks.length; i++) {
                const week = weeks[i];
                console.log(`[Monthly PDF] Processing week ${i + 1}/${weeks.length}: ${week.start.toISOString().split('T')[0]} to ${week.end.toISOString().split('T')[0]}`);
                
                // Calculate actual days in this week
                const actualDays = Math.ceil((week.end - week.start) / (1000 * 60 * 60 * 24)) + 1;
                const isPartialWeek = actualDays < 7;
                
                console.log(`[Monthly PDF] Week ${i + 1} has ${actualDays} days (${isPartialWeek ? 'partial' : 'full'})`);
                
                // Set currentStartDate to this week
                currentStartDate = week.start;
                
                // Refresh map rendering
                updateDisplay();
                
                // Wait for rendering - important!
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                    // Calculate capture width based on actual days
                    let captureWidth, captureHeight;
                    
                    if (isPartialWeek) {
                        // For partial week, calculate specific width
                        // Width = y-axis + (actualDays * 24 hours * HOUR_WIDTH)
                        const yAxisWidth = document.querySelector('.y-axis-column')?.offsetWidth || 60;
                        captureWidth = yAxisWidth + (actualDays * 24 * 25); // 25 = HOUR_WIDTH
                        captureHeight = berthMapContainer.scrollHeight;
                        console.log(`[Monthly PDF] Partial week capture width: ${captureWidth}px (${actualDays} days)`);
                    } else {
                        // For full week, use full scrollWidth
                        captureWidth = berthMapContainer.scrollWidth;
                        captureHeight = berthMapContainer.scrollHeight;
                    }
                    
                    // Capture the berth map container
                    const canvas = await html2canvas(berthMapContainer, {
                        scale: 1,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        width: captureWidth,
                        height: captureHeight
                    });
                    
                    if (canvas.width === 0 || canvas.height === 0) {
                        console.warn(`[Monthly PDF] Skipping empty canvas for week ${i + 1}`);
                        continue;
                    }
                    
                    const imgData = canvas.toDataURL('image/png', 0.95);
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    
                    // Fit to full page width
                    let imgWidth = pageWidth;
                    let imgHeight = (canvas.height / canvas.width) * imgWidth;
                    
                    // Jika lebih tinggi dari page height, skala down
                    if (imgHeight > pageHeight) {
                        imgHeight = pageHeight;
                        imgWidth = (canvas.width / canvas.height) * imgHeight;
                    }
                    
                    // Center if needed
                    const xPos = (pageWidth - imgWidth) / 2;
                    const yPos = (pageHeight - imgHeight) / 2;
                    
                    if (!isFirstPage) {
                        pdf.addPage();
                    }
                    
                    pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                    isFirstPage = false;
                    console.log(`[Monthly PDF] Added week ${i + 1}, canvas: ${canvas.width}x${canvas.height}, pdf: ${imgWidth}x${imgHeight}mm`);
                    
                } catch (pageError) {
                    console.error(`[Monthly PDF] Error processing week ${i + 1}:`, pageError);
                }
            }
            
            // Restore original date and view
            currentStartDate = new Date(originalStartDate);
            updateDisplay();
            
            // Restore UI
            mainHeader.classList.remove('hide-for-pdf');
            gridScroll.style.overflowX = oldGridScrollOverflow;
            gridScroll.scrollLeft = oldGridScrollLeft;
            legendsScrollContainer.scrollLeft = oldLegendsScrollLeft;
            if (currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = oldTimeIndicatorDisplay;
            if (berthDividerLinePDF) berthDividerLinePDF.style.display = oldDividerDisplay;
            
            // Save PDF
            pdf.save(filename);
            console.log('[Monthly PDF] PDF saved successfully');
            alert('✅ PDF berhasil di-download! 1 halaman = 1 minggu');
            
        } catch (error) {
            console.error('Error exporting monthly PDF:', error);
            console.error('Stack:', error.stack);
            alert('❌ Error: ' + error.message);
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnHTML;
        }
    }

    async function exportCustomDatePDF(startDateStr, endDateStr) {
        const exportBtn = document.getElementById('export-pdf-btn');
        const originalBtnHTML = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generate...';
        
        const pdfHeader = document.getElementById('pdf-header');
        const pelindoLogoInHeader = pdfHeader.querySelector('.pdf-logo');
        const mainHeader = document.querySelector('.main-header');
        const berthMapContainer = document.getElementById('berth-map-container');
        const legendsScrollContainer = document.querySelector('.legends-scroll-container');
        const currentTimeIndicatorPDF = document.getElementById('current-time-indicator');
        const berthDividerLinePDF = document.getElementById('berth-divider-line');
        const gridScroll = document.querySelector('.grid-scroll-container');
        
        try {
            const filename = `Berth-Allocation-Custom-${startDateStr}_to_${endDateStr}.pdf`;
            
            console.log(`[Custom PDF] Exporting from ${startDateStr} to ${endDateStr}`);
            
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            
            // Save original date
            const originalStartDate = new Date(currentStartDate);
            
            // Generate weeks array (include partial weeks)
            const weeks = [];
            let weekStart = new Date(startDate);
            while (weekStart <= endDate) {
                let weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                
                // Include semua minggu, termasuk yang partial di akhir
                if (weekEnd > endDate) {
                    weekEnd = new Date(endDate);
                }
                
                weeks.push({
                    start: new Date(weekStart),
                    end: new Date(weekEnd)
                });
                
                weekStart.setDate(weekStart.getDate() + 7);
            }
            
            console.log(`[Custom PDF] Total weeks to export: ${weeks.length}`);
            
            // Prepare UI for PDF
            mainHeader.classList.add('hide-for-pdf');
            
            if (pelindoLogoInHeader) {
                pelindoLogoInHeader.crossOrigin = "anonymous";
            }
            
            // Save original states
            const oldGridScrollOverflow = gridScroll.style.overflowX;
            const oldGridScrollLeft = gridScroll.scrollLeft;
            const oldLegendsScrollLeft = legendsScrollContainer.scrollLeft;
            const oldTimeIndicatorDisplay = currentTimeIndicatorPDF ? currentTimeIndicatorPDF.style.display : 'none';
            const oldDividerDisplay = berthDividerLinePDF ? berthDividerLinePDF.style.display : 'block';
            
            // Hide time indicators
            if (currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = 'none';
            if (berthDividerLinePDF) berthDividerLinePDF.style.display = 'none';
            
            // Set grid to show full width
            gridScroll.style.overflowX = 'visible';
            gridScroll.scrollLeft = 0;
            legendsScrollContainer.scrollLeft = 0;
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            
            let isFirstPage = true;
            
            for (let i = 0; i < weeks.length; i++) {
                const week = weeks[i];
                console.log(`[Custom PDF] Processing week ${i + 1}/${weeks.length}: ${week.start.toISOString().split('T')[0]} to ${week.end.toISOString().split('T')[0]}`);
                
                // Calculate actual days in this week
                const actualDays = Math.ceil((week.end - week.start) / (1000 * 60 * 60 * 24)) + 1;
                const isPartialWeek = actualDays < 7;
                
                console.log(`[Custom PDF] Week ${i + 1} has ${actualDays} days (${isPartialWeek ? 'partial' : 'full'})`);
                
                // Set currentStartDate to this week
                currentStartDate = week.start;
                
                // Refresh map rendering
                updateDisplay();
                
                // Wait for rendering
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                    // Calculate capture width based on actual days
                    let captureWidth, captureHeight;
                    
                    if (isPartialWeek) {
                        // For partial week, calculate specific width
                        // Width = y-axis + (actualDays * 24 hours * HOUR_WIDTH)
                        const yAxisWidth = document.querySelector('.y-axis-column')?.offsetWidth || 60;
                        captureWidth = yAxisWidth + (actualDays * 24 * 25); // 25 = HOUR_WIDTH
                        captureHeight = berthMapContainer.scrollHeight;
                        console.log(`[Custom PDF] Partial week capture width: ${captureWidth}px (${actualDays} days)`);
                    } else {
                        // For full week, use full scrollWidth
                        captureWidth = berthMapContainer.scrollWidth;
                        captureHeight = berthMapContainer.scrollHeight;
                    }
                    
                    // Capture the berth map container
                    const canvas = await html2canvas(berthMapContainer, {
                        scale: 1,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        width: captureWidth,
                        height: captureHeight
                    });
                    
                    if (canvas.width === 0 || canvas.height === 0) {
                        console.warn(`[Custom PDF] Skipping empty canvas for week ${i + 1}`);
                        continue;
                    }
                    
                    const imgData = canvas.toDataURL('image/png', 0.95);
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    
                    // Fit to full page width
                    let imgWidth = pageWidth;
                    let imgHeight = (canvas.height / canvas.width) * imgWidth;
                    
                    // Jika lebih tinggi dari page height, skala down
                    if (imgHeight > pageHeight) {
                        imgHeight = pageHeight;
                        imgWidth = (canvas.width / canvas.height) * imgHeight;
                    }
                    
                    // Center
                    const xPos = (pageWidth - imgWidth) / 2;
                    const yPos = (pageHeight - imgHeight) / 2;
                    
                    if (!isFirstPage) {
                        pdf.addPage();
                    }
                    
                    pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
                    isFirstPage = false;
                    console.log(`[Custom PDF] Added week ${i + 1}, canvas: ${canvas.width}x${canvas.height}, pdf: ${imgWidth}x${imgHeight}mm`);
                    
                } catch (pageError) {
                    console.error(`[Custom PDF] Error processing week ${i + 1}:`, pageError);
                }
            }
            
            // Restore original date and view
            currentStartDate = new Date(originalStartDate);
            updateDisplay();
            
            // Restore UI
            mainHeader.classList.remove('hide-for-pdf');
            gridScroll.style.overflowX = oldGridScrollOverflow;
            gridScroll.scrollLeft = oldGridScrollLeft;
            legendsScrollContainer.scrollLeft = oldLegendsScrollLeft;
            if (currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = oldTimeIndicatorDisplay;
            if (berthDividerLinePDF) berthDividerLinePDF.style.display = oldDividerDisplay;
            
            // Save PDF
            pdf.save(filename);
            console.log('[Custom PDF] PDF saved successfully');
            alert('✅ PDF berhasil di-download!');
            
        } catch (error) {
            console.error('Error exporting custom date PDF:', error);
            console.error('Stack:', error.stack);
            alert('❌ Error: ' + error.message);
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnHTML;
        }
    }

    async function exportToPDF(type = 'weekly', customStartDate = null, customEndDate = null) {
        console.log(`[PDF Export] Starting export process for type: ${type}`, { customStartDate, customEndDate });
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
            let capturePages = []; // Array untuk menyimpan info pages yang akan di-capture

            const mapFullWidth = gridContainer.scrollWidth + (yAxisColumn ? yAxisColumn.offsetWidth : 0);
            const legendsFullWidth = legendsWrapper.scrollWidth;
            const fullWidth = Math.max(mapFullWidth, legendsFullWidth);

            const hourWidth = HOUR_WIDTH;
            const dayWidth = 24 * hourWidth;
            const yAxisWidth = yAxisColumn ? yAxisColumn.offsetWidth : 0;
            
            // Batasan maksimal lebar per capture untuk menghindari html2canvas limitation
            const MAX_CAPTURE_WIDTH = 7000; // pixels

            // --- LOGIKA BERBAGAI TIPE PDF ---
            if (type === '1-2days') {
                // 1-2 Hari (Hari Ini & Besok)
                let selectedDay = new Date(currentStartDate);
                let nextDay = new Date(selectedDay);
                nextDay.setDate(selectedDay.getDate() + 1);

                pdfDateRangeStr = `${formatDateForPDF(selectedDay)} to ${formatDateForPDF(nextDay)}`;
                pdfFileName = `Berth-Allocation-1-2Hari-${selectedDay.toISOString().split('T')[0]}.pdf`;

                captureWidth = yAxisWidth + (2 * dayWidth); 
                targetScrollLeft = 0; 
                captureStartX = targetScrollLeft; 

                gridScroll.style.overflowX = 'hidden';
                gridScroll.scrollLeft = targetScrollLeft;
                legendsScrollContainer.scrollLeft = 0;

            } else if (type === 'weekly') {
                // Mingguan (7 hari)
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

            } else if (type === 'monthly') {
                // Bulanan akan di-handle di capture section (split per minggu)
                let startDate = new Date(currentStartDate);
                startDate.setDate(1);
                let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                
                pdfDateRangeStr = `${formatDate(startDate)} - ${formatDate(endDate)}`;
                pdfFileName = `Berth-Allocation-Bulanan-${startDate.toISOString().split('T')[0]}.pdf`;
                
                // captureWidth tidak digunakan untuk monthly karena di-handle per minggu
                captureWidth = 0;

            } else if (type === 'custom') {
                // Custom Date Range
                if (!customStartDate || !customEndDate) {
                    alert('❌ Tanggal mulai dan selesai harus dipilih!');
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = originalBtnHTML;
                    return;
                }

                const start = new Date(customStartDate);
                const end = new Date(customEndDate);
                
                if (start > end) {
                    alert('❌ Tanggal mulai tidak boleh lebih besar dari tanggal selesai!');
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = originalBtnHTML;
                    return;
                }

                const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                
                pdfDateRangeStr = `${formatDate(start)} - ${formatDate(end)}`;
                pdfFileName = `Berth-Allocation-Custom-${start.toISOString().split('T')[0]}_to_${end.toISOString().split('T')[0]}.pdf`;

                captureWidth = yAxisWidth + (daysDiff * dayWidth);
                captureStartX = 0;
                targetScrollLeft = 0;
                
                gridScroll.style.overflowX = 'visible';
                gridScroll.scrollLeft = 0;
                legendsScrollContainer.scrollLeft = 0;

            } else {
                // Default: Weekly
                let startDate = new Date(currentStartDate);
                let endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                pdfDateRangeStr = `${formatDate(startDate)} - ${formatDate(endDate)}`;

                pdfFileName = `Berth-Allocation-Default-${startDate.toISOString().split('T')[0]}.pdf`;
                captureWidth = fullWidth;
                captureStartX = 0;
                targetScrollLeft = 0;
                
                gridScroll.style.overflowX = 'visible';
                gridScroll.scrollLeft = 0;
                legendsScrollContainer.scrollLeft = 0;
            }

            // Jika bukan monthly, set width untuk capture
            if (type !== 'monthly') {
                // --- SET LEBAR UNTUK CAPTURE ---
                pdfHeader.style.width = `${captureWidth}px`;
                berthMapContainer.style.width = `${captureWidth}px`;
                legendsScrollContainer.style.width = (type === '1-2days' ? `${legendsFullWidth}px` : `${captureWidth}px`);
            }
            // Untuk monthly, width akan di-set per minggu di section capture
            
            const dateRangeEl = pdfHeader.querySelector('.pdf-date-range');
            if(dateRangeEl && type !== 'monthly') {
                // Untuk non-monthly, set date range sekarang
                dateRangeEl.textContent = pdfDateRangeStr;
            }
            // Untuk monthly, dateRangeEl akan di-update per minggu di section capture
            
            pdfHeader.style.display = 'flex'; 
            if(berthDividerLinePDF) berthDividerLinePDF.style.display = 'block';
            if(currentTimeIndicatorPDF) currentTimeIndicatorPDF.style.display = 'block'; 

            if (type !== '1-2days' && yAxisColumn) {
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

            let doc = null;
            let pdfWidthMM = 0;

            // ===== JIKA MONTHLY: SPLIT PER MINGGU =====
            if (type === 'monthly') {
                console.log(`[PDF Export] Monthly export - splitting by weeks`);
                
                let startDate = new Date(currentStartDate);
                startDate.setDate(1); // Mulai dari hari 1 bulan
                let endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0); // Hari terakhir bulan
                
                // Array untuk menyimpan semua weeks
                let weeks = [];
                let currentWeekStart = new Date(startDate);
                
                while (currentWeekStart <= endDate) {
                    let currentWeekEnd = new Date(currentWeekStart);
                    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6); // +6 untuk total 7 hari
                    
                    if (currentWeekEnd > endDate) {
                        currentWeekEnd = new Date(endDate);
                    }
                    
                    const daysInWeek = Math.ceil((currentWeekEnd - currentWeekStart) / (1000 * 60 * 60 * 24)) + 1;
                    
                    weeks.push({
                        start: new Date(currentWeekStart),
                        end: new Date(currentWeekEnd),
                        daysInWeek: daysInWeek,
                        dateStr: `${formatDate(new Date(currentWeekStart))} - ${formatDate(new Date(currentWeekEnd))}`
                    });
                    
                    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
                }
                
                // Buat PDF dengan multiple pages
                doc = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                    compress: true
                });
                
                // Capture setiap minggu
                for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
                    const weekInfo = weeks[weekIdx];
                    const weekWidth = yAxisWidth + (weekInfo.daysInWeek * dayWidth);
                    
                    // Update width untuk minggu ini
                    pdfHeader.style.width = `${weekWidth}px`;
                    berthMapContainer.style.width = `${weekWidth}px`;
                    legendsScrollContainer.style.width = `${weekWidth}px`;
                    
                    // Update date range di header
                    const dateRangeEl = pdfHeader.querySelector('.pdf-date-range');
                    if (dateRangeEl) {
                        dateRangeEl.textContent = weekInfo.dateStr;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 300)); // Delay untuk render
                    
                    // Capture untuk minggu ini
                    const optionsHeaderWeek = {
                        ...commonOptions,
                        width: weekWidth,
                        height: pdfHeader.offsetHeight,
                        x: 0
                    };
                    
                    const optionsMapWeek = {
                        ...commonOptions,
                        width: weekWidth,
                        height: berthMapContainer.scrollHeight,
                        x: 0
                    };
                    
                    const optionsLegendsWeek = {
                        ...commonOptions,
                        width: weekWidth,
                        height: legendsScrollContainer.scrollHeight,
                        x: 0
                    };
                    
                    // Capture semua elemen
                    const canvasHeaderWeek = await html2canvas(pdfHeader, optionsHeaderWeek);
                    const canvasMapWeek = await html2canvas(berthMapContainer, optionsMapWeek);
                    const canvasLegendsWeek = await html2canvas(legendsScrollContainer, optionsLegendsWeek);
                    
                    // Hitung ukuran
                    pdfWidthMM = (canvasMapWeek.width / scale / 96) * 25.4;
                    const headerHeightMM = (canvasHeaderWeek.height / scale / 96) * 25.4;
                    const mapHeightMM = (canvasMapWeek.height / scale / 96) * 25.4;
                    const legenHeightMM = (canvasLegendsWeek.height / scale / 96) * 25.4;
                    
                    // Tambah page baru (kecuali page pertama)
                    if (weekIdx > 0) {
                        doc.addPage();
                    }
                    
                    let yOffset = 0;
                    
                    // Add header
                    const headerImgData = canvasHeaderWeek.toDataURL('image/jpeg', 0.75);
                    const headerWidthMM = (canvasHeaderWeek.width / scale / 96) * 25.4;
                    doc.addImage(headerImgData, 'JPEG', 0, yOffset, headerWidthMM, headerHeightMM, undefined, 'FAST');
                    yOffset += headerHeightMM;
                    
                    // Add map
                    const mapImgData = canvasMapWeek.toDataURL('image/jpeg', 0.75);
                    const mapWidthMM = (canvasMapWeek.width / scale / 96) * 25.4;
                    doc.addImage(mapImgData, 'JPEG', 0, yOffset, mapWidthMM, mapHeightMM, undefined, 'FAST');
                    yOffset += mapHeightMM;
                    
                    // Add legends
                    const legenImgData = canvasLegendsWeek.toDataURL('image/jpeg', 0.75);
                    const legenWidthMM = (canvasLegendsWeek.width / scale / 96) * 25.4;
                    doc.addImage(legenImgData, 'JPEG', 0, yOffset, legenWidthMM, legenHeightMM, undefined, 'FAST');
                }
                
            } else {
                // ===== JIKA BUKAN MONTHLY: CAPTURE NORMAL =====
                const optionsBerthMap = {
                    ...commonOptions,
                    width: captureWidth, 
                    height: berthMapContainer.scrollHeight,
                    x: 0, 
                };

                const optionsLegends = {
                    ...commonOptions,
                    width: (type === '1-2days' ? legendsFullWidth : captureWidth),
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
                pdfWidthMM = (canvasMapCombined.width / scale / 96) * 25.4; 
                const totalPdfHeightMM = canvases.reduce((sum, c) => sum + (c.height / scale / 96) * 25.4, 0);

                doc = new jsPDF({
                    orientation: pdfWidthMM > totalPdfHeightMM ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: [pdfWidthMM, totalPdfHeightMM],
                    compress: true
                });

                let yOffset = 0;
                for (const canvas of canvases) {
                    const imgData = canvas.toDataURL('image/jpeg', 0.75); 
                    
                    const imgHeightMM = (canvas.height / scale / 96) * 25.4;
                    const imgWidthMM = (canvas.width / scale / 96) * 25.4;
                    
                    doc.addImage(imgData, 'JPEG', 0, yOffset, imgWidthMM, imgHeightMM, undefined, 'FAST');
                    yOffset += imgHeightMM;
                }
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
                    const tbody = table.querySelector('tbody');
                    
                    // Clear semua baris
                    tbody.innerHTML = '';
                    
                    // Tambahkan 1 baris kosong
                    addCommLogRow();
                    
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

        // Master Ships Modal Event Listeners
        const masterShipsBtn = document.getElementById('master-ships-btn');
        const masterShipsModal = document.getElementById('master-ships-modal');
        const closeMasterShipsModal = document.getElementById('close-master-ships-modal');
        const addNewMasterShipBtn = document.getElementById('add-new-master-ship-btn');
        const masterShipForm = document.getElementById('master-ship-form');
        const masterShipFormContainer = document.getElementById('master-ship-form-container');
        const cancelMasterShipForm = document.getElementById('cancel-master-ship-form');

        if (masterShipsBtn) {
            masterShipsBtn.addEventListener('click', async () => {
                await loadMasterShips();
                masterShipFormContainer.style.display = 'none';
                masterShipsModal.style.display = 'block';
            });
        }

        if (closeMasterShipsModal) {
            closeMasterShipsModal.addEventListener('click', () => {
                masterShipsModal.style.display = 'none';
                masterShipFormContainer.style.display = 'none';
                masterShipForm.reset();
                document.getElementById('master-ship-id').value = ''; // Clear ID when closing modal
            });
        }

        if (addNewMasterShipBtn) {
            addNewMasterShipBtn.addEventListener('click', () => {
                editingMasterShipId = null;
                masterShipForm.reset();
                document.getElementById('master-ship-id').value = ''; // Clear ID explicitly
                document.getElementById('master-ship-form-title').textContent = 'Tambah Data Kapal';
                masterShipFormContainer.style.display = 'block';
            });
        }

        if (cancelMasterShipForm) {
            cancelMasterShipForm.addEventListener('click', () => {
                masterShipForm.reset();
                document.getElementById('master-ship-id').value = ''; // Clear ID explicitly
                masterShipFormContainer.style.display = 'none';
            });
        }

        if (masterShipForm) {
            masterShipForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const idValue = document.getElementById('master-ship-id').value;
                const lengthValue = document.getElementById('master-length').value;
                const draftValue = document.getElementById('master-draft').value;
                
                const formData = {
                    id: (idValue && idValue !== '') ? parseInt(idValue) : null,
                    ship_name: document.getElementById('master-ship-name').value,
                    shipping_line: document.getElementById('master-shipping-line').value,
                    ship_code: document.getElementById('master-ship-code').value,
                    year: document.getElementById('master-year').value,
                    window: document.getElementById('master-window').value,
                    length: (lengthValue && lengthValue !== '') ? parseFloat(lengthValue) : null,
                    draft: (draftValue && draftValue !== '') ? parseFloat(draftValue) : null,
                    destination_port: document.getElementById('master-destination-port').value,
                    next_port: document.getElementById('master-next-port').value
                };

                console.log('📤 Submitting master ship data:', formData);

                const success = await saveMasterShip(formData);
                if (success) {
                    masterShipForm.reset();
                    masterShipFormContainer.style.display = 'none';
                    alert('✅ Data kapal berhasil disimpan!');
                }
            });
        }

        // Auto-fill ship data when ship name is selected/changed
        const shipNameInput = document.getElementById('ship-name');
        if (shipNameInput) {
            shipNameInput.addEventListener('change', (e) => {
                autoFillShipDataFromMaster(e.target.value);
            });
            // Also listen to input event for instant autocomplete
            shipNameInput.addEventListener('input', (e) => {
                const exactMatch = masterShips.find(s => s.ship_name.toLowerCase() === e.target.value.toLowerCase());
                if (exactMatch) {
                    autoFillShipDataFromMaster(e.target.value);
                }
            });
        }

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
            if (event.target == masterShipsModal) {
                masterShipsModal.style.display = 'none';
                masterShipFormContainer.style.display = 'none';
                masterShipForm.reset();
                document.getElementById('master-ship-id').value = ''; // Clear ID when clicking outside
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
                
                // Buat date object dengan waktu lokal (ETB)
                const etbDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                
                // RUMUS BARU: ETC = ETB + ((Discharge + Loading) / BSH) - 1 jam
                const workingHours = (discharge + loading) / bsh;
                const etcDate = new Date(etbDate.getTime()); // Clone ETB date
                
                // Tambahkan working hours, lalu kurangi 1 jam
                const etcTotalMinutes = etcDate.getHours() * 60 + etcDate.getMinutes() + (workingHours * 60) - 60; // -60 menit = -1 jam
                etcDate.setHours(0, 0, 0, 0); // Reset ke 00:00
                etcDate.setMinutes(etcDate.getMinutes() + etcTotalMinutes);
                
                // Format datetime ke datetime-local format
                const formatDateTime = (date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    const h = String(date.getHours()).padStart(2, '0');
                    const min = String(date.getMinutes()).padStart(2, '0');
                    return `${y}-${m}-${d}T${h}:${min}`;
                };
                
                etcInput.value = formatDateTime(etcDate);
                
                // RUMUS BARU: ETD = ETC + 1 jam
                // ETD selalu mengikuti ETC + 1 jam (otomatis update)
                const etdDate = new Date(etcDate.getTime()); // Clone ETC date
                etdDate.setHours(etdDate.getHours() + 1); // Tambah 1 jam
                etdInput.value = formatDateTime(etdDate);
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
                const wsCode = (document.getElementById('ship-ws-code')?.value || '').trim();
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
                    alert("❌ Pelayaran kosong! Silakan pilih nama kapal dari master data atau tambahkan ke master data terlebih dahulu.");
                    return;
                }
                if (!code) {
                    alert("❌ Kode kapal kosong! Silakan pilih nama kapal dari master data atau tambahkan ke master data terlebih dahulu.");
                    return;
                }
                if (!wsCode) {
                    alert("❌ Kode WS kosong! Wajib diisi.");
                    return;
                }
                
                // Validasi BSH
                const bsh = (document.getElementById('ship-bsh')?.value || '').trim();
                if (!bsh) {
                    alert("❌ BSH kosong! Wajib diisi.");
                    return;
                }
                
                // Validasi Berth Side
                const berthSideCheck = (document.getElementById('ship-berth-side')?.value || '').trim();
                if (!berthSideCheck) {
                    alert("❌ Berth Side kosong! Pilih P atau S.");
                    return;
                }
                
                // Validasi QCC - minimal 1 checkbox harus dipilih
                const qccCheckboxes = document.querySelectorAll('input[name="qcc-options"]:checked');
                if (qccCheckboxes.length === 0) {
                    alert("❌ QCC kosong! Pilih minimal 1 QCC.");
                    return;
                }
                
                // Validasi Discharge
                const discharge = document.getElementById('discharge-value')?.value;
                if (discharge === null || discharge === undefined || discharge === '') {
                    alert("❌ Discharge kosong! Wajib diisi.");
                    return;
                }
                
                // Validasi Loading
                const loading = document.getElementById('load-value')?.value;
                if (loading === null || loading === undefined || loading === '') {
                    alert("❌ Loading kosong! Wajib diisi.");
                    return;
                }
                
                if (!length) {
                    alert("❌ Panjang kapal kosong! Silakan pilih nama kapal dari master data atau tambahkan ke master data terlebih dahulu.");
                    return;
                }
                if (!draft) {
                    alert("❌ Draft kapal kosong! Silakan pilih nama kapal dari master data atau tambahkan ke master data terlebih dahulu.");
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
                
                const selectedQccCheckboxes = document.querySelectorAll('#qcc-checkbox-group input[type="checkbox"]:checked');
                const checkedQCCs = Array.from(selectedQccCheckboxes).map(cb => cb.value);
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
                const type = e.target.dataset.type || e.target.closest('.pdf-option-btn').dataset.type;
                
                // Tutup dropdown
                pdfOptionsContainer.style.display = 'none';
                
                if (type === 'custom') {
                    // Buka modal untuk custom date
                    const customDateModal = document.getElementById('custom-date-modal');
                    const pdfStartDate = document.getElementById('pdf-start-date');
                    const pdfEndDate = document.getElementById('pdf-end-date');
                    
                    // Set default dates
                    const today = new Date();
                    const nextWeek = new Date(today);
                    nextWeek.setDate(today.getDate() + 7);
                    
                    pdfStartDate.value = today.toISOString().split('T')[0];
                    pdfEndDate.value = nextWeek.toISOString().split('T')[0];
                    
                    customDateModal.style.display = 'block';
                } else if (type === 'monthly') {
                    // Export bulanan menggunakan server-side (PHP)
                    exportMonthlyPDF(); 
                } else {
                    // Export langsung untuk tipe lain (1-2days, weekly)
                    exportToPDF(type); 
                }
            });
        });

        // Event listeners untuk Custom Date Modal
        const customDateModal = document.getElementById('custom-date-modal');
        const closeDateModal = document.getElementById('close-date-modal');
        const cancelDatePdf = document.getElementById('cancel-date-pdf');
        const confirmDatePdf = document.getElementById('confirm-date-pdf');

        // Close modal handlers
        if (closeDateModal) {
            closeDateModal.addEventListener('click', () => {
                customDateModal.style.display = 'none';
            });
        }

        if (cancelDatePdf) {
            cancelDatePdf.addEventListener('click', () => {
                customDateModal.style.display = 'none';
            });
        }

        // Confirm custom date PDF
        if (confirmDatePdf) {
            confirmDatePdf.addEventListener('click', () => {
                const startDate = document.getElementById('pdf-start-date').value;
                const endDate = document.getElementById('pdf-end-date').value;
                
                if (!startDate || !endDate) {
                    alert('❌ Silakan pilih tanggal mulai dan tanggal selesai!');
                    return;
                }
                
                customDateModal.style.display = 'none';
                exportCustomDatePDF(startDate, endDate);
            });
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === customDateModal) {
                customDateModal.style.display = 'none';
            }
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
