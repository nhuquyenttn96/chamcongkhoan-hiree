/**
 * CHẤM CÔNG ĐỘI KHOÁN - FULLSTACK FRONTEND CONTROLLER
 * Phiên bản: 2026.11.27_ver1.0
 */

// State toàn cục của ứng dụng
const state = {
  settings: {},
  teams: [],
  attendance: [],
  advances: [],
  selectedDate: getTodayString(),
  selectedMonth: getCurrentMonthString(),
  currentTab: 'tab-quick'
};

// Định dạng tiền tệ VNĐ
function formatMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' đ';
}

// Định dạng ngày hiển thị DD/MM/YYYY
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Lấy chuỗi ngày hôm nay YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Lấy chuỗi tháng hiện tại YYYY-MM
function getCurrentMonthString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initDateControls();
  initTabs();
  initModals();
  fetchInitialData();
  checkOnlineStatus();
  // Định kỳ cập nhật trạng thái online nếu chưa sẵn sàng
  const onlineTimer = setInterval(async () => {
    await checkOnlineStatus();
    const urlInput = document.getElementById('inputPublicUrl');
    if (urlInput && urlInput.value && urlInput.value.includes('trycloudflare.com')) {
      clearInterval(onlineTimer);
    }
  }, 3000);
});

// Khởi tạo các bộ chọn ngày ở Header
function initDateControls() {
  const dateInput = document.getElementById('selectedDate');
  dateInput.value = state.selectedDate;

  dateInput.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    updateDateDisplay();
    renderQuickAttendance();
    syncDetailTabDate();
  });

  document.getElementById('btnToday').addEventListener('click', () => {
    state.selectedDate = getTodayString();
    dateInput.value = state.selectedDate;
    updateDateDisplay();
    renderQuickAttendance();
    syncDetailTabDate();
  });

  document.getElementById('btnPrevDay').addEventListener('click', () => {
    changeSelectedDate(-1);
  });

  document.getElementById('btnNextDay').addEventListener('click', () => {
    changeSelectedDate(1);
  });

  updateDateDisplay();
}

function changeSelectedDate(offsetDays) {
  const d = new Date(state.selectedDate);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  state.selectedDate = `${year}-${month}-${day}`;
  document.getElementById('selectedDate').value = state.selectedDate;
  updateDateDisplay();
  renderQuickAttendance();
  syncDetailTabDate();
}

function updateDateDisplay() {
  const disp = document.getElementById('displayQuickDate');
  if (disp) {
    disp.textContent = formatDateDisplay(state.selectedDate);
  }
}

function syncDetailTabDate() {
  const detailDateInput = document.getElementById('detailSelectDate');
  if (detailDateInput) {
    detailDateInput.value = state.selectedDate;
  }
}

// Điều hướng Tab
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.currentTab = tabId;

  // Cập nhật style nút tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active-tab', 'bg-blue-600', 'text-white');
      btn.classList.remove('text-slate-600');
    } else {
      btn.classList.remove('active-tab', 'bg-blue-600', 'text-white');
      btn.classList.add('text-slate-600');
    }
  });

  // Hiển thị section tab tương ứng
  document.querySelectorAll('.tab-content').forEach(section => {
    if (section.id === tabId) {
      section.classList.remove('hidden');
      section.classList.add('block');
    } else {
      section.classList.add('hidden');
      section.classList.remove('block');
    }
  });

  // Refresh dữ liệu theo tab
  if (tabId === 'tab-quick') {
    renderQuickAttendance();
  } else if (tabId === 'tab-detail') {
    renderDetailAttendanceView();
  } else if (tabId === 'tab-reports') {
    renderReportsView();
  } else if (tabId === 'tab-advances') {
    renderAdvancesTable();
  } else if (tabId === 'tab-teams') {
    renderTeamsConfig();
  }

  // Refresh icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// Tải dữ liệu ban đầu từ Backend
async function fetchInitialData() {
  try {
    const res = await fetch('/api/data');
    const json = await res.json();
    if (json.success && json.data) {
      state.settings = json.data.settings || {};
      state.teams = json.data.teams || [];
      state.attendance = json.data.attendance || [];
      state.advances = json.data.advances || [];

      // Hiển thị thông tin dự án
      if (state.settings.projectName) {
        document.getElementById('topProjectName').textContent = `${state.settings.projectName} • Quản lý công nhật & đội khoán`;
        document.getElementById('settingProjectName').value = state.settings.projectName;
      }
      if (state.settings.companyName) {
        document.getElementById('settingCompanyName').value = state.settings.companyName;
      }
      if (state.settings.defaultOtMultiplier) {
        document.getElementById('settingOtMultiplier').value = state.settings.defaultOtMultiplier;
      }

      // Populate dropdowns
      populateTeamDropdowns();

      // Render tab mặc định
      renderQuickAttendance();
    }
  } catch (err) {
    console.error('Không thể nạp dữ liệu:', err);
    showToast('Không thể kết nối đến máy chủ', 'error');
  }
}

// Điền danh sách đội vào các dropdown
function populateTeamDropdowns() {
  const detailSelect = document.getElementById('detailSelectTeam');
  const reportSelect = document.getElementById('reportFilterTeam');
  const advanceSelect = document.getElementById('advanceModalTeamId');

  if (detailSelect) {
    detailSelect.innerHTML = state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  if (reportSelect) {
    reportSelect.innerHTML = `<option value="ALL">-- Tất cả các đội khoán (${state.teams.length} đội) --</option>` +
      state.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }

  if (advanceSelect) {
    advanceSelect.innerHTML = state.teams.map(t => `<option value="${t.id}">${t.name} (${t.leader || 'Chưa rõ đại diện'})</option>`).join('');
  }
}

// ========================================================
// TAB 1: CHẤM NHANH (CHẤM TỔNG THEO ĐỘI)
// ========================================================

function renderQuickAttendance() {
  const container = document.getElementById('quickAttendanceList');
  if (!container) return;

  const searchQuery = (document.getElementById('quickSearchTeam')?.value || '').toLowerCase().trim();
  const filteredTeams = state.teams.filter(t => t.name.toLowerCase().includes(searchQuery) || (t.leader && t.leader.toLowerCase().includes(searchQuery)));

  // Thống kê sơ bộ ngày đang chọn
  let markedCount = 0;
  let totalDaysToday = 0;
  let totalCostToday = 0;

  state.teams.forEach(t => {
    const rec = state.attendance.find(a => a.date === state.selectedDate && a.teamId === t.id);
    if (rec && (rec.totalWorkDays > 0 || rec.otHours > 0)) {
      markedCount++;
      totalDaysToday += rec.totalWorkDays;
      totalCostToday += (rec.totalAmount || 0);
    }
  });

  document.getElementById('statTotalTeams').textContent = state.teams.length;
  document.getElementById('statMarkedTeams').textContent = `${markedCount} / ${state.teams.length}`;
  document.getElementById('statTodayWorkDays').textContent = `${totalDaysToday} công`;
  document.getElementById('statTodayCost').textContent = formatMoney(totalCostToday);
  document.getElementById('badgeQuickCount').textContent = markedCount;

  if (filteredTeams.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
        <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="text-sm font-semibold">Chưa có đội khoán nào hoặc không tìm thấy kết quả.</p>
        <button onclick="switchTab('tab-teams')" class="mt-3 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100">
          + Thêm đội khoán mới ngay
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filteredTeams.map(team => {
    const rec = state.attendance.find(a => a.date === state.selectedDate && a.teamId === team.id);
    const hasRecord = !!rec;
    const workDays = hasRecord ? rec.totalWorkDays : 0;
    const otHours = hasRecord ? (rec.otHours || 0) : 0;
    const taskCat = hasRecord ? (rec.taskCategory || '') : '';
    const note = hasRecord ? (rec.note || '') : '';
    const isDetailMode = hasRecord && rec.type === 'DETAIL';

    return `
      <div class="quick-team-card bg-white rounded-xl border ${hasRecord && workDays > 0 ? 'border-emerald-300 ring-1 ring-emerald-400/30' : 'border-slate-200'} shadow-sm hover:shadow transition overflow-hidden flex flex-col justify-between" data-team-id="${team.id}">
        <!-- Card Header -->
        <div class="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-800 text-sm md:text-base leading-tight">${team.name}</h3>
              ${isDetailMode ? `<span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Chi tiết thợ</span>` : ''}
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">
              ${team.leader ? `Đội trưởng: <b>${team.leader}</b>` : ''} 
              ${team.phone ? `• SĐT: ${team.phone}` : ''}
            </p>
          </div>
          <span class="text-xs font-bold px-2 py-0.5 rounded-full ${hasRecord && workDays > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
            ${hasRecord && workDays > 0 ? `${workDays} công` : 'Chưa chấm'}
          </span>
        </div>

        <!-- Card Body: Nhập liệu công -->
        <div class="p-4 space-y-3.5 flex-1">
          <!-- Hàng 1: Tổng số công với nút bấm nhanh -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-blue-600"></i>
                Tổng số công hôm nay:
              </label>
              <span class="text-[11px] text-slate-400">Đơn giá: ${formatMoney(team.defaultRate)}</span>
            </div>

            <div class="flex items-center gap-1.5">
              <button type="button" onclick="adjustQuickWorkDays('${team.id}', -1)" class="quick-counter-btn w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm border border-slate-200 active:scale-95 transition">-1</button>
              <button type="button" onclick="adjustQuickWorkDays('${team.id}', -0.5)" class="quick-counter-btn w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 active:scale-95 transition">-0.5</button>
              
              <input type="number" step="0.5" min="0" id="quick_days_${team.id}" value="${workDays}" 
                class="flex-1 text-center font-extrabold text-lg text-blue-700 bg-blue-50/50 border border-blue-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
              
              <button type="button" onclick="adjustQuickWorkDays('${team.id}', 0.5)" class="quick-counter-btn w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 active:scale-95 transition">+0.5</button>
              <button type="button" onclick="adjustQuickWorkDays('${team.id}', 1)" class="quick-counter-btn w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm border border-blue-600 active:scale-95 transition">+1</button>
            </div>
          </div>

          <!-- Hàng 2: Tăng ca OT & Hạng mục -->
          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-1">
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Tăng ca (h):</label>
              <input type="number" step="0.5" min="0" id="quick_ot_${team.id}" value="${otHours}" 
                placeholder="0" class="w-full text-center text-xs font-bold text-amber-700 bg-slate-50 border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500">
            </div>
            <div class="col-span-2">
              <label class="block text-[11px] font-semibold text-slate-600 mb-1">Vị trí / Hạng mục:</label>
              <input type="text" id="quick_cat_${team.id}" value="${escapeHtml(taskCat)}" 
                placeholder="VD: Cốt thép sàn T2..." class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
          </div>

          <!-- Ghi chú nhanh -->
          <div>
            <input type="text" id="quick_note_${team.id}" value="${escapeHtml(note)}" 
              placeholder="Ghi chú thêm (vd: 5 thợ chính, 1 thợ phụ)..." class="w-full text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
          </div>
        </div>

        <!-- Card Footer Actions -->
        <div class="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
          <button type="button" onclick="goToDetailAttendance('${team.id}')" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline">
            <i data-lucide="users" class="w-3.5 h-3.5"></i>
            <span>Chấm thợ (${team.workers ? team.workers.length : 0})</span>
          </button>

          <div class="flex items-center gap-2">
            ${hasRecord && (workDays > 0 || otHours > 0) ? `
              <button type="button" onclick="deleteQuickAttendance('${team.id}')" title="Xóa bỏ ngày công này nếu chấm nhầm" class="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-lg text-xs border border-rose-200 transition active:scale-95">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-600"></i>
                <span>Xóa Công</span>
              </button>
            ` : ''}

            <button type="button" onclick="saveSingleQuickAttendance('${team.id}')" class="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition active:scale-95">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>Lưu Đội Này</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function adjustQuickWorkDays(teamId, delta) {
  const input = document.getElementById(`quick_days_${teamId}`);
  if (input) {
    let current = parseFloat(input.value) || 0;
    current = Math.max(0, Math.round((current + delta) * 10) / 10);
    input.value = current;
  }
}

// Lưu 1 đội duy nhất từ Tab Chấm Nhanh
async function saveSingleQuickAttendance(teamId) {
  const workDays = parseFloat(document.getElementById(`quick_days_${teamId}`)?.value) || 0;
  const otHours = parseFloat(document.getElementById(`quick_ot_${teamId}`)?.value) || 0;
  const taskCategory = document.getElementById(`quick_cat_${teamId}`)?.value || '';
  const note = document.getElementById(`quick_note_${teamId}`)?.value || '';

  const item = {
    teamId,
    totalWorkDays: workDays,
    otHours,
    taskCategory,
    note
  };

  try {
    const res = await fetch('/api/attendance/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.selectedDate,
        items: [item]
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã lưu chấm công thành công!', 'success');
      await refreshData();
    } else {
      showToast(result.message || 'Lỗi khi lưu', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi kết nối máy chủ', 'error');
  }
}

// Xóa bản ghi chấm công của đội trong ngày đang chọn
async function deleteQuickAttendance(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  const teamName = team ? team.name : 'đội này';
  const rec = state.attendance.find(a => a.date === state.selectedDate && a.teamId === teamId);

  if (!confirm(`Bạn có chắc chắn muốn XÓA BỎ công ngày ${formatDateDisplay(state.selectedDate)} của "${teamName}"?`)) {
    return;
  }

  try {
    if (rec && rec.id) {
      const res = await fetch(`/api/attendance/${rec.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã xóa công ngày ${formatDateDisplay(state.selectedDate)} của ${teamName}`, 'success');
      }
    } else {
      await fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: state.selectedDate,
          items: [{ teamId, totalWorkDays: 0, otHours: 0, taskCategory: '', note: '' }]
        })
      });
      showToast(`Đã xóa công ngày ${formatDateDisplay(state.selectedDate)} của ${teamName}`, 'success');
    }

    // Reset giao diện trên thẻ
    const daysInput = document.getElementById(`quick_days_${teamId}`);
    const otInput = document.getElementById(`quick_ot_${teamId}`);
    const catInput = document.getElementById(`quick_cat_${teamId}`);
    const noteInput = document.getElementById(`quick_note_${teamId}`);
    if (daysInput) daysInput.value = 0;
    if (otInput) otInput.value = 0;
    if (catInput) catInput.value = '';
    if (noteInput) noteInput.value = '';

    await refreshData();
    renderQuickAttendance();
  } catch (err) {
    console.error('Lỗi khi xóa công:', err);
    showToast('Lỗi khi xóa công', 'error');
  }
}

// Nút Lưu Tất Cả Các Đội
document.getElementById('btnSaveAllQuick')?.addEventListener('click', async () => {
  const items = [];
  state.teams.forEach(team => {
    const inputDays = document.getElementById(`quick_days_${team.id}`);
    if (inputDays) {
      const workDays = parseFloat(inputDays.value) || 0;
      const otHours = parseFloat(document.getElementById(`quick_ot_${team.id}`)?.value) || 0;
      const taskCategory = document.getElementById(`quick_cat_${team.id}`)?.value || '';
      const note = document.getElementById(`quick_note_${team.id}`)?.value || '';

      items.push({
        teamId: team.id,
        totalWorkDays: workDays,
        otHours,
        taskCategory,
        note
      });
    }
  });

  try {
    const res = await fetch('/api/attendance/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: state.selectedDate,
        items
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã lưu chấm công cho toàn bộ các đội!', 'success');
      await refreshData();
    } else {
      showToast(result.message || 'Lỗi khi lưu', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi mạng', 'error');
  }
});

// Tìm kiếm nhanh đội khoán
document.getElementById('quickSearchTeam')?.addEventListener('input', () => {
  renderQuickAttendance();
});

// Chuyển thẳng từ thẻ Chấm nhanh sang Tab Chấm chi tiết
function goToDetailAttendance(teamId) {
  const select = document.getElementById('detailSelectTeam');
  if (select) {
    select.value = teamId;
  }
  const dateInput = document.getElementById('detailSelectDate');
  if (dateInput) {
    dateInput.value = state.selectedDate;
  }
  switchTab('tab-detail');
}

// ========================================================
// TAB 2: CHẤM CHI TIẾT TỪNG THỢ
// ========================================================

function renderDetailAttendanceView() {
  const teamSelect = document.getElementById('detailSelectTeam');
  const dateInput = document.getElementById('detailSelectDate');
  if (!teamSelect) return;

  const selectedTeamId = teamSelect.value || (state.teams[0]?.id);
  const selectedDate = dateInput.value || state.selectedDate;
  const team = state.teams.find(t => t.id === selectedTeamId);

  if (!team) return;

  // Lấy bản ghi chấm công ngày đó nếu có
  const existingRec = state.attendance.find(a => a.date === selectedDate && a.teamId === selectedTeamId);
  const taskCategoryInput = document.getElementById('detailTaskCategory');
  if (taskCategoryInput) {
    taskCategoryInput.value = existingRec ? (existingRec.taskCategory || '') : '';
  }

  // Update Team Banner
  document.getElementById('detailBannerTeamName').textContent = team.name;
  document.getElementById('detailBannerLeader').textContent = team.leader || 'Chưa cập nhật';
  document.getElementById('detailBannerPhone').textContent = team.phone || 'Chưa có';
  document.getElementById('detailBannerRate').textContent = formatMoney(team.defaultRate) + ' / công';

  // Render Danh Sách Thợ
  const tbody = document.getElementById('detailWorkerTableBody');
  const workers = team.workers || [];

  if (workers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-slate-400">
          <p class="font-semibold text-sm">Đội này chưa có danh sách thợ.</p>
          <button onclick="openAddWorkerModal('${team.id}')" class="mt-2 text-xs bg-indigo-50 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100">
            + Thêm thợ thành viên ngay
          </button>
        </td>
      </tr>
    `;
    updateDetailBannerTotals(team, []);
    return;
  }

  tbody.innerHTML = workers.map((w, index) => {
    // Tìm thông tin thợ đã chấm trong ngày
    let workDay = 1.0; // Mặc định 1 công
    let otHours = 0;
    let note = '';

    if (existingRec && existingRec.workerRecords) {
      const wRec = existingRec.workerRecords.find(item => item.workerId === w.id);
      if (wRec) {
        workDay = wRec.workDay !== undefined ? wRec.workDay : 1.0;
        otHours = wRec.otHours || 0;
        note = wRec.note || '';
      }
    } else if (existingRec && existingRec.type === 'TOTAL') {
      // Nếu trước đó chấm tổng, ta tạm chia đều hoặc giữ nguyên
      workDay = 1.0;
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100" data-worker-id="${w.id}">
        <td class="py-3 px-4 text-center font-bold text-slate-400">${index + 1}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800 text-sm">${escapeHtml(w.name)}</div>
          <div class="text-[11px] text-slate-400">${w.phone ? `SĐT: ${w.phone}` : ''}</div>
        </td>
        <td class="py-3 px-4">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${w.role === 'Đội trưởng' ? 'bg-amber-100 text-amber-800' : (w.role === 'Thợ chính' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600')}">
            ${escapeHtml(w.role || 'Thợ')}
          </span>
        </td>
        <!-- Các nút chấm nhanh 1 chạm cho thợ -->
        <td class="py-3 px-4 text-center">
          <div class="inline-flex rounded-md shadow-sm" role="group">
            <button type="button" onclick="setWorkerWorkDay('${w.id}', 1.0)" class="btn-quick-worker text-xs font-bold px-2.5 py-1 rounded-l-md border border-slate-200 ${workDay === 1.0 ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}">
              1.0
            </button>
            <button type="button" onclick="setWorkerWorkDay('${w.id}', 0.5)" class="btn-quick-worker text-xs font-bold px-2 py-1 border-t border-b border-slate-200 ${workDay === 0.5 ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}">
              0.5
            </button>
            <button type="button" onclick="setWorkerWorkDay('${w.id}', 0)" class="btn-quick-worker text-xs font-bold px-2.5 py-1 rounded-r-md border border-slate-200 ${workDay === 0 ? 'bg-rose-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}">
              Vắng
            </button>
          </div>
        </td>
        <!-- Ô nhập công chính xác -->
        <td class="py-3 px-4 text-center">
          <input type="number" step="0.25" min="0" id="worker_day_${w.id}" value="${workDay}" oninput="recalcDetailBanner()" 
            class="w-16 text-center font-bold text-sm bg-slate-50 border border-slate-300 rounded-lg py-1 text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
        </td>
        <!-- Tăng ca OT -->
        <td class="py-3 px-4 text-center">
          <input type="number" step="0.5" min="0" id="worker_ot_${w.id}" value="${otHours}" oninput="recalcDetailBanner()" 
            class="w-14 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg py-1 text-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-500">
        </td>
        <!-- Ghi chú cá nhân -->
        <td class="py-3 px-4">
          <input type="text" id="worker_note_${w.id}" value="${escapeHtml(note)}" placeholder="Lý do đi muộn, việc riêng..." 
            class="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
        </td>
        <!-- Xóa thợ khỏi đội -->
        <td class="py-3 px-4 text-center">
          <button type="button" onclick="removeWorkerFromTeam('${team.id}', '${w.id}')" title="Xóa thợ khỏi danh sách đội" class="text-slate-400 hover:text-red-600 transition p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  recalcDetailBanner();
  if (window.lucide) lucide.createIcons();
}

function setWorkerWorkDay(workerId, val) {
  const input = document.getElementById(`worker_day_${workerId}`);
  if (input) {
    input.value = val;
    renderDetailAttendanceView(); // Refresh buttons styling
  }
}

function recalcDetailBanner() {
  const teamSelect = document.getElementById('detailSelectTeam');
  if (!teamSelect) return;
  const team = state.teams.find(t => t.id === teamSelect.value);
  if (!team) return;

  let totalDays = 0;
  let totalOt = 0;

  (team.workers || []).forEach(w => {
    const dayInput = document.getElementById(`worker_day_${w.id}`);
    const otInput = document.getElementById(`worker_ot_${w.id}`);
    if (dayInput) totalDays += (parseFloat(dayInput.value) || 0);
    if (otInput) totalOt += (parseFloat(otInput.value) || 0);
  });

  const otMultiplier = state.settings.defaultOtMultiplier || 1.5;
  const otInDays = (totalOt / 8) * otMultiplier;
  const totalAmount = Math.round((totalDays + otInDays) * (team.defaultRate || 0));

  document.getElementById('detailBannerTotalDays').textContent = totalDays;
  document.getElementById('detailBannerTotalOt').textContent = totalOt;
  document.getElementById('detailBannerTotalAmount').textContent = formatMoney(totalAmount);
}

// Lưu Chấm Công Chi Tiết
document.getElementById('btnSaveDetail')?.addEventListener('click', async () => {
  const teamSelect = document.getElementById('detailSelectTeam');
  const dateInput = document.getElementById('detailSelectDate');
  const taskCatInput = document.getElementById('detailTaskCategory');

  const teamId = teamSelect.value;
  const date = dateInput.value;
  const taskCategory = taskCatInput ? taskCatInput.value : '';

  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  const workerRecords = (team.workers || []).map(w => {
    const day = parseFloat(document.getElementById(`worker_day_${w.id}`)?.value) || 0;
    const ot = parseFloat(document.getElementById(`worker_ot_${w.id}`)?.value) || 0;
    const note = document.getElementById(`worker_note_${w.id}`)?.value || '';
    return {
      workerId: w.id,
      workerName: w.name,
      role: w.role,
      workDay: day,
      otHours: ot,
      status: day > 0 ? 'present' : 'absent',
      note
    };
  });

  try {
    const res = await fetch('/api/attendance/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        teamId,
        workerRecords,
        taskCategory,
        rate: team.defaultRate
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã lưu chấm công chi tiết & đồng bộ tổng công!', 'success');
      await refreshData();
      renderDetailAttendanceView();
    } else {
      showToast(result.message || 'Lỗi khi lưu', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi mạng', 'error');
  }
});

// Xóa bản ghi chấm công từ Tab Chấm Chi Tiết
document.getElementById('btnDeleteDetail')?.addEventListener('click', async () => {
  const teamSelect = document.getElementById('detailSelectTeam');
  const dateInput = document.getElementById('detailSelectDate');
  const teamId = teamSelect.value;
  const date = dateInput.value;

  const team = state.teams.find(t => t.id === teamId);
  const teamName = team ? team.name : 'đội này';
  const rec = state.attendance.find(a => a.date === date && a.teamId === teamId);

  if (!confirm(`Bạn có chắc chắn muốn XÓA BỎ công ngày ${formatDateDisplay(date)} của "${teamName}"?`)) {
    return;
  }

  try {
    if (rec && rec.id) {
      await fetch(`/api/attendance/${rec.id}`, { method: 'DELETE' });
    }
    // Đặt lại các thợ về 0 công
    (team.workers || []).forEach(w => {
      const input = document.getElementById(`worker_day_${w.id}`);
      const ot = document.getElementById(`worker_ot_${w.id}`);
      if (input) input.value = 0;
      if (ot) ot.value = 0;
    });

    showToast(`Đã xóa sạch công ngày ${formatDateDisplay(date)} của ${teamName}`, 'success');
    await refreshData();
    renderDetailAttendanceView();
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi xóa công', 'error');
  }
});

// Nút Tất Cả 1 Công
document.getElementById('btnMarkAllPresent')?.addEventListener('click', () => {
  const teamSelect = document.getElementById('detailSelectTeam');
  const team = state.teams.find(t => t.id === teamSelect.value);
  if (team && team.workers) {
    team.workers.forEach(w => {
      const input = document.getElementById(`worker_day_${w.id}`);
      if (input) input.value = 1.0;
    });
    renderDetailAttendanceView();
    showToast('Đã đặt tất cả 1.0 công', 'info');
  }
});

document.getElementById('detailSelectTeam')?.addEventListener('change', renderDetailAttendanceView);
document.getElementById('detailSelectDate')?.addEventListener('change', renderDetailAttendanceView);


// ========================================================
// TAB 3: BẢNG CÔNG & XUẤT EXCEL BÁO CÁO
// ========================================================

function renderReportsView() {
  const monthInput = document.getElementById('reportSelectMonth');
  if (monthInput && !monthInput.value) {
    monthInput.value = state.selectedMonth;
  }
  const selectedMonth = monthInput ? monthInput.value : state.selectedMonth;
  const filterTeamId = document.getElementById('reportFilterTeam')?.value || 'ALL';

  document.getElementById('reportMonthLabel').textContent = selectedMonth;

  // Lấy số ngày trong tháng được chọn
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Lọc danh sách đội
  const activeTeams = filterTeamId === 'ALL' 
    ? state.teams 
    : state.teams.filter(t => t.id === filterTeamId);

  // Tính toán KPI Tổng Hợp Tháng
  let totalDaysAll = 0;
  let totalAmountAll = 0;
  let totalAdvanceAll = 0;

  // Lọc attendance trong tháng
  const monthAttendance = state.attendance.filter(a => a.date && a.date.startsWith(selectedMonth));
  const monthAdvances = state.advances.filter(adv => adv.date && adv.date.startsWith(selectedMonth));

  activeTeams.forEach(team => {
    const teamAtt = monthAttendance.filter(a => a.teamId === team.id);
    const teamAdv = monthAdvances.filter(adv => adv.teamId === team.id);

    teamAtt.forEach(a => {
      totalDaysAll += (a.totalWorkDays || 0);
      totalAmountAll += (a.totalAmount || 0);
    });

    teamAdv.forEach(adv => {
      totalAdvanceAll += (adv.amount || 0);
    });
  });

  const totalRemainingAll = totalAmountAll - totalAdvanceAll;

  document.getElementById('reportTotalDays').textContent = `${totalDaysAll} công`;
  document.getElementById('reportTotalAmount').textContent = formatMoney(totalAmountAll);
  document.getElementById('reportTotalAdvance').textContent = formatMoney(totalAdvanceAll);
  document.getElementById('reportTotalRemaining').textContent = formatMoney(totalRemainingAll);

  // 1. RENDER MA TRẬN CHẤM CÔNG (GRID MATRIX)
  const matrixTable = document.getElementById('matrixTable');
  if (matrixTable) {
    let theadHtml = `
      <thead>
        <tr>
          <th class="sticky-col">Đội Khoán / Ngày</th>
    `;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month - 1, day);
      const isSunday = dayDate.getDay() === 0;
      theadHtml += `<th class="${isSunday ? 'text-red-500 font-bold bg-red-50' : ''}">${day}</th>`;
    }
    theadHtml += `
          <th class="font-bold bg-blue-50 text-blue-800">Tổng Công</th>
          <th class="font-bold bg-amber-50 text-amber-800">Tổng OT</th>
          <th class="font-bold bg-emerald-50 text-emerald-800">Thành Tiền</th>
        </tr>
      </thead>
    `;

    let tbodyHtml = '<tbody>';
    activeTeams.forEach(team => {
      let teamMonthDays = 0;
      let teamMonthOt = 0;
      let teamMonthAmount = 0;

      tbodyHtml += `<tr><td class="sticky-col text-slate-800">${escapeHtml(team.name)}</td>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
        const rec = monthAttendance.find(a => a.date === dayStr && a.teamId === team.id);
        const dayDate = new Date(year, month - 1, day);
        const isSunday = dayDate.getDay() === 0;

        if (rec && (rec.totalWorkDays > 0 || rec.otHours > 0)) {
          teamMonthDays += rec.totalWorkDays;
          teamMonthOt += (rec.otHours || 0);
          teamMonthAmount += (rec.totalAmount || 0);

          tbodyHtml += `
            <td class="bg-emerald-100 text-emerald-900 font-bold cursor-pointer hover:bg-emerald-200 transition" 
                title="${team.name} - Ngày ${dayStr}: ${rec.totalWorkDays} công, OT: ${rec.otHours || 0}h"
                onclick="quickEditMatrixCell('${team.id}', '${dayStr}')">
              ${rec.totalWorkDays}${rec.otHours ? `<span class="text-[9px] text-amber-700 block font-normal">+${rec.otHours}h</span>` : ''}
            </td>
          `;
        } else {
          tbodyHtml += `<td class="${isSunday ? 'bg-slate-100/60' : ''} text-slate-300 cursor-pointer hover:bg-slate-200" onclick="quickEditMatrixCell('${team.id}', '${dayStr}')">•</td>`;
        }
      }

      tbodyHtml += `
        <td class="font-bold text-blue-700 bg-blue-50">${teamMonthDays}</td>
        <td class="font-bold text-amber-700 bg-amber-50">${teamMonthOt}h</td>
        <td class="font-bold text-emerald-700 bg-emerald-50 text-right pr-2">${formatMoney(teamMonthAmount)}</td>
      </tr>`;
    });

    tbodyHtml += '</tbody>';
    matrixTable.innerHTML = theadHtml + tbodyHtml;
  }

  // 2. RENDER BẢNG TỔNG HỢP CHI PHÍ & TẠM ỨNG
  const costTableBody = document.getElementById('reportTeamCostTableBody');
  if (costTableBody) {
    costTableBody.innerHTML = activeTeams.map(team => {
      const teamAtt = monthAttendance.filter(a => a.teamId === team.id);
      const teamAdv = monthAdvances.filter(adv => adv.teamId === team.id);

      let tDays = 0;
      let tOt = 0;
      let tAmount = 0;
      let tAdvance = 0;

      teamAtt.forEach(a => {
        tDays += (a.totalWorkDays || 0);
        tOt += (a.otHours || 0);
        tAmount += (a.totalAmount || 0);
      });

      teamAdv.forEach(adv => {
        tAdvance += (adv.amount || 0);
      });

      const tRemaining = tAmount - tAdvance;

      return `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
          <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(team.name)}</td>
          <td class="py-3 px-4 text-xs text-slate-500">${escapeHtml(team.leader || '--')} • ${team.phone || '--'}</td>
          <td class="py-3 px-4 text-right font-medium text-slate-700">${formatMoney(team.defaultRate)}</td>
          <td class="py-3 px-4 text-center font-bold text-blue-600">${tDays} công</td>
          <td class="py-3 px-4 text-center font-bold text-amber-600">${tOt}h</td>
          <td class="py-3 px-4 text-right font-bold text-slate-800">${formatMoney(tAmount)}</td>
          <td class="py-3 px-4 text-right font-bold text-amber-600">${formatMoney(tAdvance)}</td>
          <td class="py-3 px-4 text-right font-extrabold ${tRemaining > 0 ? 'text-emerald-700' : 'text-slate-600'}">${formatMoney(tRemaining)}</td>
        </tr>
      `;
    }).join('');
  }
}

function quickEditMatrixCell(teamId, dateStr) {
  state.selectedDate = dateStr;
  document.getElementById('selectedDate').value = dateStr;
  updateDateDisplay();
  switchTab('tab-quick');
}

document.getElementById('reportSelectMonth')?.addEventListener('change', (e) => {
  state.selectedMonth = e.target.value;
  renderReportsView();
});
document.getElementById('reportFilterTeam')?.addEventListener('change', renderReportsView);

// XUẤT EXCEL CHUYÊN NGHIỆP CHUẨN IN ẤN & KẾ TOÁN (EXCELJS + SHEETJS FALLBACK)
document.getElementById('btnExportExcel')?.addEventListener('click', async () => {
  const selectedMonth = document.getElementById('reportSelectMonth')?.value || state.selectedMonth;
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthAttendance = state.attendance.filter(a => a.date && a.date.startsWith(selectedMonth));
  const monthAdvances = state.advances.filter(adv => adv.date && adv.date.startsWith(selectedMonth));

  // Max width calculation for dynamic fit
  let maxTeamLen = 22;
  let maxLeaderLen = 14;
  state.teams.forEach(t => {
    if (t.name && t.name.length > maxTeamLen) maxTeamLen = t.name.length;
    if (t.leader && t.leader.length > maxLeaderLen) maxLeaderLen = t.leader.length;
  });

  // PHƯƠNG ÁN CHÍNH: EXCELJS (CHUẨN IN ẤN 1B - VIỀN NÉT MẢNH, ĐỊNH DẠNG SỐ, CHỮ KÝ 2B)
  if (typeof ExcelJS !== 'undefined') {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Chấm công đội_HIREE';
      workbook.created = new Date();

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      const doubleBottomBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      const headerFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F4F7' } // Tối giản, thanh lịch, chuẩn in ấn A4
      };

      // ----------------------------------------------------
      // SHEET 1: BẢNG CHẤM CÔNG CHI TIẾT
      // ----------------------------------------------------
      const ws1 = workbook.addWorksheet('Bang_Cham_Cong', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
      });

      const totalCols1 = 4 + daysInMonth + 3;

      // Tiêu đề 1
      ws1.mergeCells(1, 1, 1, totalCols1);
      const titleRow1 = ws1.getCell(1, 1);
      titleRow1.value = `BẢNG CHẤM CÔNG ĐỘI KHOÁN - THÁNG ${monthStr}/${yearStr}`;
      titleRow1.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF000000' } };
      titleRow1.alignment = { vertical: 'middle', horizontal: 'center' };
      ws1.getRow(1).height = 30;

      // Tiêu đề 2 (Thông tin đơn vị / dự án)
      ws1.mergeCells(2, 1, 2, totalCols1);
      const titleRow2 = ws1.getCell(2, 1);
      titleRow2.value = `Đơn vị: ${state.settings.companyName || 'Chấm công đội_HIREE'}   |   Dự án: ${state.settings.projectName || 'Chấm công đội_HIREE'}`;
      titleRow2.font = { name: 'Times New Roman', size: 11, italic: true };
      titleRow2.alignment = { vertical: 'middle', horizontal: 'center' };
      ws1.getRow(2).height = 20;

      // Dòng 3 trống
      ws1.getRow(3).height = 8;

      // Dòng 4: Header cột
      const headerRow4 = ws1.getRow(4);
      headerRow4.height = 28;
      const colHeaders1 = ['STT', 'Đội Khoán', 'Đại Diện', 'Đơn Giá (đ)'];
      for (let d = 1; d <= daysInMonth; d++) {
        colHeaders1.push(`N${d}`);
      }
      colHeaders1.push('Tổng Công', 'Tổng OT (h)', 'Thành Tiền (đ)');

      colHeaders1.forEach((val, idx) => {
        const cell = headerRow4.getCell(idx + 1);
        cell.value = val;
        cell.font = { name: 'Times New Roman', size: 10, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.fill = headerFill;
        cell.border = thinBorder;
      });

      // Dữ liệu từng đội
      let rowIdx = 5;
      let grandTotalDays = 0;
      let grandTotalOt = 0;
      let grandTotalAmount = 0;
      const colDayTotals = new Array(daysInMonth).fill(0);

      state.teams.forEach((team, tIdx) => {
        const row = ws1.getRow(rowIdx);
        row.height = 22;

        let tDays = 0;
        let tOt = 0;
        let tAmount = 0;

        // Cột 1: STT
        const cellSTT = row.getCell(1);
        cellSTT.value = tIdx + 1;
        cellSTT.alignment = { vertical: 'middle', horizontal: 'center' };
        cellSTT.border = thinBorder;
        cellSTT.font = { name: 'Times New Roman', size: 10 };

        // Cột 2: Đội Khoán
        const cellTeam = row.getCell(2);
        cellTeam.value = team.name;
        cellTeam.alignment = { vertical: 'middle', horizontal: 'left' };
        cellTeam.border = thinBorder;
        cellTeam.font = { name: 'Times New Roman', size: 10, bold: true };

        // Cột 3: Đại Diện
        const cellLeader = row.getCell(3);
        cellLeader.value = team.leader || '';
        cellLeader.alignment = { vertical: 'middle', horizontal: 'left' };
        cellLeader.border = thinBorder;
        cellLeader.font = { name: 'Times New Roman', size: 10 };

        // Cột 4: Đơn Giá
        const cellRate = row.getCell(4);
        cellRate.value = team.defaultRate || 0;
        cellRate.numFmt = '#,##0';
        cellRate.alignment = { vertical: 'middle', horizontal: 'right' };
        cellRate.border = thinBorder;
        cellRate.font = { name: 'Times New Roman', size: 10 };

        // Cột Ngày
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
          const rec = monthAttendance.find(a => a.date === dayStr && a.teamId === team.id);
          const cellDay = row.getCell(4 + d);
          cellDay.border = thinBorder;
          cellDay.alignment = { vertical: 'middle', horizontal: 'center' };
          cellDay.font = { name: 'Times New Roman', size: 10 };

          if (rec && (rec.totalWorkDays > 0 || rec.otHours > 0)) {
            tDays += (rec.totalWorkDays || 0);
            tOt += (rec.otHours || 0);
            tAmount += (rec.totalAmount || 0);
            cellDay.value = rec.totalWorkDays || '';
            if (rec.totalWorkDays > 0) cellDay.font = { name: 'Times New Roman', size: 10, bold: true };
            colDayTotals[d - 1] += (rec.totalWorkDays || 0);
          } else {
            cellDay.value = '';
          }
        }

        // Cột Tổng Công
        const cellTotDays = row.getCell(4 + daysInMonth + 1);
        cellTotDays.value = tDays;
        cellTotDays.alignment = { vertical: 'middle', horizontal: 'center' };
        cellTotDays.border = thinBorder;
        cellTotDays.font = { name: 'Times New Roman', size: 10, bold: true };

        // Cột Tổng OT
        const cellTotOt = row.getCell(4 + daysInMonth + 2);
        cellTotOt.value = tOt;
        cellTotOt.alignment = { vertical: 'middle', horizontal: 'center' };
        cellTotOt.border = thinBorder;
        cellTotOt.font = { name: 'Times New Roman', size: 10 };

        // Cột Thành Tiền
        const cellTotAmt = row.getCell(4 + daysInMonth + 3);
        cellTotAmt.value = tAmount;
        cellTotAmt.numFmt = '#,##0';
        cellTotAmt.alignment = { vertical: 'middle', horizontal: 'right' };
        cellTotAmt.border = thinBorder;
        cellTotAmt.font = { name: 'Times New Roman', size: 10, bold: true };

        grandTotalDays += tDays;
        grandTotalOt += tOt;
        grandTotalAmount += tAmount;
        rowIdx++;
      });

      // DÒNG TỔNG CỘNG TOÀN CÔNG TRƯỜNG
      const totRow = ws1.getRow(rowIdx);
      totRow.height = 24;
      ws1.mergeCells(rowIdx, 1, rowIdx, 4);
      const cellTotLabel = totRow.getCell(1);
      cellTotLabel.value = 'TỔNG CỘNG TOÀN CÔNG TRƯỜNG';
      cellTotLabel.font = { name: 'Times New Roman', size: 10, bold: true };
      cellTotLabel.alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 4; c++) {
        totRow.getCell(c).border = doubleBottomBorder;
        totRow.getCell(c).fill = headerFill;
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const cCell = totRow.getCell(4 + d);
        cCell.value = colDayTotals[d - 1] || '';
        cCell.font = { name: 'Times New Roman', size: 10, bold: true };
        cCell.alignment = { vertical: 'middle', horizontal: 'center' };
        cCell.border = doubleBottomBorder;
        cCell.fill = headerFill;
      }

      const cellGrandDays = totRow.getCell(4 + daysInMonth + 1);
      cellGrandDays.value = grandTotalDays;
      cellGrandDays.font = { name: 'Times New Roman', size: 10, bold: true };
      cellGrandDays.alignment = { vertical: 'middle', horizontal: 'center' };
      cellGrandDays.border = doubleBottomBorder;
      cellGrandDays.fill = headerFill;

      const cellGrandOt = totRow.getCell(4 + daysInMonth + 2);
      cellGrandOt.value = grandTotalOt;
      cellGrandOt.font = { name: 'Times New Roman', size: 10, bold: true };
      cellGrandOt.alignment = { vertical: 'middle', horizontal: 'center' };
      cellGrandOt.border = doubleBottomBorder;
      cellGrandOt.fill = headerFill;

      const cellGrandAmt = totRow.getCell(4 + daysInMonth + 3);
      cellGrandAmt.value = grandTotalAmount;
      cellGrandAmt.numFmt = '#,##0';
      cellGrandAmt.font = { name: 'Times New Roman', size: 10, bold: true };
      cellGrandAmt.alignment = { vertical: 'middle', horizontal: 'right' };
      cellGrandAmt.border = doubleBottomBorder;
      cellGrandAmt.fill = headerFill;

      // Khoảng cách đến khối chữ ký
      rowIdx += 2;

      // Dòng ngày tháng xuất bảng
      const today = new Date();
      const dateStr = `Đà Lạt, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
      ws1.mergeCells(rowIdx, totalCols1 - 5, rowIdx, totalCols1);
      const cellSignDate = ws1.getCell(rowIdx, totalCols1 - 5);
      cellSignDate.value = dateStr;
      cellSignDate.font = { name: 'Times New Roman', size: 10, italic: true };
      cellSignDate.alignment = { vertical: 'middle', horizontal: 'center' };
      rowIdx++;

      // KHỐI CHỮ KÝ 2 BÊN (LỰA CHỌN 2B)
      ws1.mergeCells(rowIdx, 2, rowIdx, 4);
      const cellLeftTitle = ws1.getCell(rowIdx, 2);
      cellLeftTitle.value = 'ĐẠI DIỆN ĐỘI KHOÁN';
      cellLeftTitle.font = { name: 'Times New Roman', size: 11, bold: true };
      cellLeftTitle.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(rowIdx, totalCols1 - 4, rowIdx, totalCols1);
      const cellRightTitle = ws1.getCell(rowIdx, totalCols1 - 4);
      cellRightTitle.value = 'NGƯỜI LẬP BẢNG';
      cellRightTitle.font = { name: 'Times New Roman', size: 11, bold: true };
      cellRightTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      rowIdx++;

      ws1.mergeCells(rowIdx, 2, rowIdx, 4);
      const cellLeftNote = ws1.getCell(rowIdx, 2);
      cellLeftNote.value = '(Ký, ghi rõ họ tên)';
      cellLeftNote.font = { name: 'Times New Roman', size: 9, italic: true };
      cellLeftNote.alignment = { vertical: 'middle', horizontal: 'center' };

      ws1.mergeCells(rowIdx, totalCols1 - 4, rowIdx, totalCols1);
      const cellRightNote = ws1.getCell(rowIdx, totalCols1 - 4);
      cellRightNote.value = '(Ký, ghi rõ họ tên)';
      cellRightNote.font = { name: 'Times New Roman', size: 9, italic: true };
      cellRightNote.alignment = { vertical: 'middle', horizontal: 'center' };

      // Tự động căn chỉnh độ rộng cột (Auto-fit Widths)
      ws1.getColumn(1).width = 6;
      ws1.getColumn(2).width = Math.min(Math.max(maxTeamLen + 4, 32), 48);
      ws1.getColumn(3).width = Math.min(Math.max(maxLeaderLen + 4, 18), 30);
      ws1.getColumn(4).width = 14;

      for (let d = 1; d <= daysInMonth; d++) {
        ws1.getColumn(4 + d).width = 5.2;
      }
      ws1.getColumn(4 + daysInMonth + 1).width = 11;
      ws1.getColumn(4 + daysInMonth + 2).width = 11;
      ws1.getColumn(4 + daysInMonth + 3).width = 16;

      // ----------------------------------------------------
      // SHEET 2: BẢNG TỔNG HỢP THANH TOÁN TIỀN KHOÁN
      // ----------------------------------------------------
      const ws2 = workbook.addWorksheet('Tong_Hop_Thanh_Toan', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
      });

      const totalCols2 = 10;
      ws2.mergeCells(1, 1, 1, totalCols2);
      const t2Title1 = ws2.getCell(1, 1);
      t2Title1.value = `BẢNG TỔNG HỢP THANH TOÁN TIỀN KHOÁN - THÁNG ${monthStr}/${yearStr}`;
      t2Title1.font = { name: 'Times New Roman', size: 16, bold: true };
      t2Title1.alignment = { vertical: 'middle', horizontal: 'center' };
      ws2.getRow(1).height = 30;

      ws2.mergeCells(2, 1, 2, totalCols2);
      const t2Title2 = ws2.getCell(2, 1);
      t2Title2.value = `Đơn vị: ${state.settings.companyName || 'Chấm công đội_HIREE'}   |   Dự án: ${state.settings.projectName || 'Chấm công đội_HIREE'}`;
      t2Title2.font = { name: 'Times New Roman', size: 11, italic: true };
      t2Title2.alignment = { vertical: 'middle', horizontal: 'center' };
      ws2.getRow(2).height = 20;

      ws2.getRow(3).height = 8;

      const headerRow2 = ws2.getRow(4);
      headerRow2.height = 28;
      const colHeaders2 = [
        'STT',
        'Đội Khoán',
        'Người Đại Diện',
        'Số Điện Thoại',
        'Đơn Giá/Công (đ)',
        'Tổng Công',
        'Tổng OT (h)',
        'Tổng Tiền Công (đ)',
        'Đã Tạm Ứng (đ)',
        'Còn Lại Phải Trả (đ)'
      ];

      colHeaders2.forEach((val, idx) => {
        const cell = headerRow2.getCell(idx + 1);
        cell.value = val;
        cell.font = { name: 'Times New Roman', size: 10, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.fill = headerFill;
        cell.border = thinBorder;
      });

      let sRowIdx = 5;
      let sumTotDays = 0;
      let sumTotOt = 0;
      let sumTotAmount = 0;
      let sumTotAdvance = 0;
      let sumTotRemaining = 0;

      state.teams.forEach((team, idx) => {
        const teamAtt = monthAttendance.filter(a => a.teamId === team.id);
        const teamAdv = monthAdvances.filter(adv => adv.teamId === team.id);

        let tDays = 0;
        let tOt = 0;
        let tAmount = 0;
        let tAdvance = 0;

        teamAtt.forEach(a => {
          tDays += (a.totalWorkDays || 0);
          tOt += (a.otHours || 0);
          tAmount += (a.totalAmount || 0);
        });

        teamAdv.forEach(adv => {
          tAdvance += (adv.amount || 0);
        });

        const tRemaining = tAmount - tAdvance;

        const row = ws2.getRow(sRowIdx);
        row.height = 22;

        const cellData = [
          { val: idx + 1, align: 'center', bold: false },
          { val: team.name, align: 'left', bold: true },
          { val: team.leader || '', align: 'left', bold: false },
          { val: team.phone || '', align: 'center', bold: false },
          { val: team.defaultRate || 0, align: 'right', fmt: '#,##0' },
          { val: tDays, align: 'center', bold: true },
          { val: tOt, align: 'center', bold: false },
          { val: tAmount, align: 'right', fmt: '#,##0', bold: true },
          { val: tAdvance, align: 'right', fmt: '#,##0' },
          { val: tRemaining, align: 'right', fmt: '#,##0', bold: true }
        ];

        cellData.forEach((d, cIdx) => {
          const cell = row.getCell(cIdx + 1);
          cell.value = d.val;
          cell.border = thinBorder;
          cell.font = { name: 'Times New Roman', size: 10, bold: !!d.bold };
          cell.alignment = { vertical: 'middle', horizontal: d.align };
          if (d.fmt) cell.numFmt = d.fmt;
        });

        sumTotDays += tDays;
        sumTotOt += tOt;
        sumTotAmount += tAmount;
        sumTotAdvance += tAdvance;
        sumTotRemaining += tRemaining;
        sRowIdx++;
      });

      // DÒNG TỔNG CỘNG CHO SHEET 2
      const totRow2 = ws2.getRow(sRowIdx);
      totRow2.height = 24;
      ws2.mergeCells(sRowIdx, 1, sRowIdx, 5);
      const cellTot2Label = totRow2.getCell(1);
      cellTot2Label.value = 'TỔNG CỘNG TOÀN CÔNG TRƯỜNG';
      cellTot2Label.font = { name: 'Times New Roman', size: 10, bold: true };
      cellTot2Label.alignment = { vertical: 'middle', horizontal: 'center' };

      for (let c = 1; c <= 5; c++) {
        totRow2.getCell(c).border = doubleBottomBorder;
        totRow2.getCell(c).fill = headerFill;
      }

      const totColsValues = [
        { col: 6, val: sumTotDays, align: 'center' },
        { col: 7, val: sumTotOt, align: 'center' },
        { col: 8, val: sumTotAmount, align: 'right', fmt: '#,##0' },
        { col: 9, val: sumTotAdvance, align: 'right', fmt: '#,##0' },
        { col: 10, val: sumTotRemaining, align: 'right', fmt: '#,##0' }
      ];

      totColsValues.forEach(tc => {
        const cell = totRow2.getCell(tc.col);
        cell.value = tc.val;
        cell.font = { name: 'Times New Roman', size: 10, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: tc.align };
        cell.border = doubleBottomBorder;
        cell.fill = headerFill;
        if (tc.fmt) cell.numFmt = tc.fmt;
      });

      // Khối chữ ký Sheet 2 (Lựa chọn 2B)
      sRowIdx += 2;
      ws2.mergeCells(sRowIdx, 7, sRowIdx, 10);
      const cellSignDate2 = ws2.getCell(sRowIdx, 7);
      cellSignDate2.value = dateStr;
      cellSignDate2.font = { name: 'Times New Roman', size: 10, italic: true };
      cellSignDate2.alignment = { vertical: 'middle', horizontal: 'center' };
      sRowIdx++;

      ws2.mergeCells(sRowIdx, 2, sRowIdx, 4);
      const c2LeftTitle = ws2.getCell(sRowIdx, 2);
      c2LeftTitle.value = 'ĐẠI DIỆN ĐỘI KHOÁN';
      c2LeftTitle.font = { name: 'Times New Roman', size: 11, bold: true };
      c2LeftTitle.alignment = { vertical: 'middle', horizontal: 'center' };

      ws2.mergeCells(sRowIdx, 7, sRowIdx, 10);
      const c2RightTitle = ws2.getCell(sRowIdx, 7);
      c2RightTitle.value = 'NGƯỜI LẬP BẢNG';
      c2RightTitle.font = { name: 'Times New Roman', size: 11, bold: true };
      c2RightTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      sRowIdx++;

      ws2.mergeCells(sRowIdx, 2, sRowIdx, 4);
      const c2LeftNote = ws2.getCell(sRowIdx, 2);
      c2LeftNote.value = '(Ký, ghi rõ họ tên)';
      c2LeftNote.font = { name: 'Times New Roman', size: 9, italic: true };
      c2LeftNote.alignment = { vertical: 'middle', horizontal: 'center' };

      ws2.mergeCells(sRowIdx, 7, sRowIdx, 10);
      const c2RightNote = ws2.getCell(sRowIdx, 7);
      c2RightNote.value = '(Ký, ghi rõ họ tên)';
      c2RightNote.font = { name: 'Times New Roman', size: 9, italic: true };
      c2RightNote.alignment = { vertical: 'middle', horizontal: 'center' };

      // Set column widths Sheet 2
      ws2.getColumn(1).width = 6;
      ws2.getColumn(2).width = Math.min(Math.max(maxTeamLen + 4, 32), 48);
      ws2.getColumn(3).width = Math.min(Math.max(maxLeaderLen + 4, 18), 30);
      ws2.getColumn(4).width = 15;
      ws2.getColumn(5).width = 16;
      ws2.getColumn(6).width = 12;
      ws2.getColumn(7).width = 12;
      ws2.getColumn(8).width = 18;
      ws2.getColumn(9).width = 16;
      ws2.getColumn(10).width = 18;

      // Xuất file tải về
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `Bang_Cham_Cong_Doi_Khoan_${selectedMonth}.xlsx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`Đã xuất file Excel chuẩn in ấn A4: ${fileName}`, 'success');
      return;
    } catch (err) {
      console.error('Lỗi xuất ExcelJS, chuyển sang fallback SheetJS:', err);
    }
  }

  // PHƯƠNG ÁN DỰ PHÒNG: SHEETJS NẾU CHƯA CÓ EXCELJS
  if (typeof XLSX === 'undefined') {
    showToast('Thư viện Excel đang tải, vui lòng thử lại sau 2 giây', 'error');
    return;
  }

  const matrixHeaders = ['STT', 'Đội Khoán', 'Đại Diện', 'Đơn Giá (đ)'];
  for (let d = 1; d <= daysInMonth; d++) {
    matrixHeaders.push(`N${d}`);
  }
  matrixHeaders.push('Tổng Công', 'Tổng OT (h)', 'Thành Tiền (đ)');

  const matrixRows = [
    [`BẢNG CHẤM CÔNG ĐỘI KHOÁN - THÁNG ${selectedMonth}`],
    [`Dự án: ${state.settings.projectName || 'Chấm công đội_HIREE'}`],
    [],
    matrixHeaders
  ];

  let sumDaysFallback = 0;
  let sumOtFallback = 0;
  let sumAmtFallback = 0;

  state.teams.forEach((team, idx) => {
    const row = [idx + 1, team.name, team.leader || '', team.defaultRate || 0];
    let tDays = 0;
    let tOt = 0;
    let tAmount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const rec = monthAttendance.find(a => a.date === dayStr && a.teamId === team.id);
      if (rec && (rec.totalWorkDays > 0 || rec.otHours > 0)) {
        tDays += rec.totalWorkDays;
        tOt += (rec.otHours || 0);
        tAmount += (rec.totalAmount || 0);
        row.push(rec.totalWorkDays);
      } else {
        row.push('');
      }
    }

    row.push(tDays, tOt, tAmount);
    matrixRows.push(row);
    sumDaysFallback += tDays;
    sumOtFallback += tOt;
    sumAmtFallback += tAmount;
  });

  // Total row fallback
  const fallbackTotRow = ['TỔNG CỘNG', '', '', ''];
  for (let d = 1; d <= daysInMonth; d++) fallbackTotRow.push('');
  fallbackTotRow.push(sumDaysFallback, sumOtFallback, sumAmtFallback);
  matrixRows.push(fallbackTotRow);

  // Sheet 2 Fallback
  const summaryHeaders = ['STT', 'Đội Khoán', 'Người Đại Diện', 'SĐT', 'Đơn Giá/Công', 'Tổng Công', 'Tổng OT', 'Tổng Tiền Công', 'Đã Tạm Ứng', 'Còn Lại Phải Trả'];
  const summaryRows = [
    [`BẢNG TỔNG HỢP THANH TOÁN TIỀN KHOÁN - THÁNG ${selectedMonth}`],
    [`Đơn vị: ${state.settings.companyName || 'Chấm công đội_HIREE'}`],
    [],
    summaryHeaders
  ];

  state.teams.forEach((team, idx) => {
    const teamAtt = monthAttendance.filter(a => a.teamId === team.id);
    const teamAdv = monthAdvances.filter(adv => adv.teamId === team.id);
    let tDays = 0, tOt = 0, tAmount = 0, tAdvance = 0;
    teamAtt.forEach(a => {
      tDays += (a.totalWorkDays || 0);
      tOt += (a.otHours || 0);
      tAmount += (a.totalAmount || 0);
    });
    teamAdv.forEach(adv => {
      tAdvance += (adv.amount || 0);
    });
    summaryRows.push([
      idx + 1, team.name, team.leader || '', team.phone || '',
      team.defaultRate || 0, tDays, tOt, tAmount, tAdvance, tAmount - tAdvance
    ]);
  });

  const wb = XLSX.utils.book_new();
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

  // Set auto columns in SheetJS
  const colW1 = [{ wch: 6 }, { wch: Math.max(maxTeamLen + 4, 32) }, { wch: Math.max(maxLeaderLen + 4, 18) }, { wch: 14 }];
  for (let d = 1; d <= daysInMonth; d++) colW1.push({ wch: 6 });
  colW1.push({ wch: 12 }, { wch: 12 }, { wch: 18 });
  wsMatrix['!cols'] = colW1;

  wsSummary['!cols'] = [
    { wch: 6 }, { wch: Math.max(maxTeamLen + 4, 32) }, { wch: Math.max(maxLeaderLen + 4, 18) },
    { wch: 15 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Bang_Cham_Cong');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Thanh_Toan');

  const fileName = `Bang_Cham_Cong_Doi_Khoan_${selectedMonth}.xlsx`;
  XLSX.writeFile(wb, fileName);
  showToast(`Đã xuất file Excel: ${fileName}`, 'success');
});

// Nút In
document.getElementById('btnPrintReport')?.addEventListener('click', () => {
  window.print();
});


// ========================================================
// TAB 4: TẠM ỨNG & QUYẾT TOÁN
// ========================================================

function renderAdvancesTable() {
  const tbody = document.getElementById('advancesTableBody');
  if (!tbody) return;

  if (state.advances.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-slate-400">
          Chưa có phiếu tạm ứng nào được ghi nhận.
        </td>
      </tr>
    `;
    return;
  }

  // Sắp xếp ngày mới nhất lên đầu
  const sorted = [...state.advances].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  tbody.innerHTML = sorted.map((adv, idx) => {
    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 text-center text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-3 px-4 font-semibold text-slate-700">${formatDateDisplay(adv.date)}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(adv.teamName)}</td>
        <td class="py-3 px-4 text-slate-700 font-medium">${escapeHtml(adv.recipient || '--')}</td>
        <td class="py-3 px-4 text-right font-extrabold text-purple-700">${formatMoney(adv.amount)}</td>
        <td class="py-3 px-4 text-xs text-slate-600">${escapeHtml(adv.reason || '--')}</td>
        <td class="py-3 px-4 text-xs text-slate-500">${escapeHtml(adv.note || '--')}</td>
        <td class="py-3 px-4 text-center">
          <button type="button" onclick="deleteAdvance('${adv.id}')" title="Xóa phiếu tạm ứng" class="text-slate-400 hover:text-red-600 transition p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function deleteAdvance(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa phiếu tạm ứng này?')) return;
  try {
    const res = await fetch(`/api/advances/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Đã xóa phiếu tạm ứng', 'success');
      await refreshData();
      renderAdvancesTable();
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi xóa', 'error');
  }
}


// ========================================================
// TAB 5: QUẢN LÝ ĐỘI KHOÁN & CÀI ĐẶT HỆ THỐNG
// ========================================================

function renderTeamsConfig() {
  const container = document.getElementById('teamsConfigList');
  if (!container) return;

  container.innerHTML = state.teams.map(team => {
    const workerCount = (team.workers || []).length;
    return `
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h4 class="font-bold text-slate-800 text-base flex items-center gap-2">
              ${escapeHtml(team.name)}
              <span class="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                ${workerCount} thợ
              </span>
            </h4>
            <p class="text-xs text-slate-500 mt-1">
              Người đại diện: <b>${escapeHtml(team.leader || 'Chưa rõ')}</b> • SĐT: <b>${escapeHtml(team.phone || 'Chưa có')}</b>
            </p>
            <p class="text-xs text-emerald-700 font-bold mt-1">
              Đơn giá công: ${formatMoney(team.defaultRate)} / ${team.unit || 'Công'}
            </p>
            ${team.note ? `<p class="text-[11px] text-slate-500 italic mt-1">${escapeHtml(team.note)}</p>` : ''}
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="openEditTeamModal('${team.id}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg transition">
              Sửa
            </button>
            <button onclick="deleteTeam('${team.id}')" class="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg transition">
              Xóa
            </button>
          </div>
        </div>

        <!-- Danh sách thợ trong đội -->
        <div class="mt-3 pt-3 border-t border-slate-100">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-600">Thành viên đội (${workerCount} người):</span>
            <button onclick="openAddWorkerModal('${team.id}')" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
              + Thêm thợ
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5">
            ${(team.workers || []).map(w => `
              <span class="inline-flex items-center gap-1.5 text-xs bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg">
                <b>${escapeHtml(w.name)}</b>
                <span class="text-[10px] text-slate-400">(${w.role})</span>
                <button type="button" onclick="removeWorkerFromTeam('${team.id}', '${w.id}')" class="text-slate-300 hover:text-red-500 font-bold">×</button>
              </span>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Lưu Cấu Hình Dự Án
document.getElementById('btnSaveSettings')?.addEventListener('click', async () => {
  const projectName = document.getElementById('settingProjectName')?.value;
  const companyName = document.getElementById('settingCompanyName')?.value;
  const defaultOtMultiplier = parseFloat(document.getElementById('settingOtMultiplier')?.value) || 1.5;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName, companyName, defaultOtMultiplier })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Đã lưu cấu hình dự án!', 'success');
      document.getElementById('topProjectName').textContent = `${projectName} • Quản lý công nhật & đội khoán`;
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi lưu cấu hình', 'error');
  }
});

// Sao lưu & Khôi phục
document.getElementById('btnExportBackup')?.addEventListener('click', () => {
  window.location.href = '/api/backup/export';
});

document.getElementById('fileRestoreBackup')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (!confirm('Khôi phục sẽ thay thế dữ liệu hiện tại bằng file backup. Bạn có chắc chắn muốn tiếp tục?')) return;

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Khôi phục dữ liệu thành công!', 'success');
        await refreshData();
        switchTab('tab-quick');
      } else {
        showToast(json.message || 'Lỗi khi khôi phục', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('File backup không hợp lệ', 'error');
    }
  };
  reader.readAsText(file);
});


// ========================================================
// CÁC HÀM XỬ LÝ MODALS & FORM
// ========================================================

function initModals() {
  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // Modal Đội Khoán
  document.getElementById('btnOpenAddTeamModal')?.addEventListener('click', () => {
    document.getElementById('modalTeamTitle').textContent = 'Thêm Đội Khoán Mới';
    document.getElementById('formTeam').reset();
    document.getElementById('teamModalId').value = '';
    openModal('modalTeam');
  });

  document.getElementById('formTeam')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('teamModalId').value;
    const name = document.getElementById('teamModalName').value;
    const leader = document.getElementById('teamModalLeader').value;
    const phone = document.getElementById('teamModalPhone').value;
    const defaultRate = parseFloat(document.getElementById('teamModalRate').value) || 0;
    const note = document.getElementById('teamModalNote').value;

    const payload = { name, leader, phone, defaultRate, note };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/teams/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      const json = await res.json();
      if (json.success) {
        showToast('Đã lưu đội khoán thành công!', 'success');
        closeAllModals();
        await refreshData();
        populateTeamDropdowns();
        renderTeamsConfig();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi lưu đội', 'error');
    }
  });

  // Modal Thợ
  document.getElementById('btnOpenAddWorkerModal')?.addEventListener('click', () => {
    const teamSelect = document.getElementById('detailSelectTeam');
    if (teamSelect && teamSelect.value) {
      openAddWorkerModal(teamSelect.value);
    }
  });

  document.getElementById('formWorker')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamId = document.getElementById('workerModalTeamId').value;
    const name = document.getElementById('workerModalName').value;
    const role = document.getElementById('workerModalRole').value;
    const phone = document.getElementById('workerModalPhone').value;

    const team = state.teams.find(t => t.id === teamId);
    if (!team) return;

    if (!team.workers) team.workers = [];
    team.workers.push({
      id: 'w_' + Date.now(),
      name,
      role,
      phone
    });

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workers: team.workers })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Đã thêm thợ "${name}" vào đội!`, 'success');
        closeAllModals();
        await refreshData();
        if (state.currentTab === 'tab-detail') renderDetailAttendanceView();
        if (state.currentTab === 'tab-teams') renderTeamsConfig();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi thêm thợ', 'error');
    }
  });

  // Modal Tạm Ứng
  document.getElementById('btnOpenAddAdvanceModal')?.addEventListener('click', () => {
    document.getElementById('formAdvance').reset();
    document.getElementById('advanceModalDate').value = state.selectedDate;
    openModal('modalAdvance');
  });

  document.getElementById('formAdvance')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('advanceModalDate').value;
    const teamId = document.getElementById('advanceModalTeamId').value;
    const amount = parseFloat(document.getElementById('advanceModalAmount').value) || 0;
    const recipient = document.getElementById('advanceModalRecipient').value;
    const reason = document.getElementById('advanceModalReason').value;
    const note = document.getElementById('advanceModalNote').value;

    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, teamId, amount, recipient, reason, note })
      });
      const json = await res.json();
      if (json.success) {
        showToast('Đã tạo phiếu tạm ứng thành công!', 'success');
        closeAllModals();
        await refreshData();
        renderAdvancesTable();
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tạo phiếu tạm ứng', 'error');
    }
  });
  // Modal Chia Sẻ Link Cho Điện Thoại (4G Online)
  document.getElementById('btnOpenShareOnlineModal')?.addEventListener('click', () => {
    openModal('modalShareOnline');
    checkOnlineStatus(true);
  });

  document.getElementById('btnCopyPublicUrl')?.addEventListener('click', () => {
    const urlInput = document.getElementById('inputPublicUrl');
    if (urlInput && urlInput.value && urlInput.value.startsWith('http')) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
          showToast('Đã sao chép link! Dán vào Zalo để gửi cho mọi người', 'success');
        }).catch(() => {
          urlInput.select();
          document.execCommand('copy');
          showToast('Đã sao chép link!', 'success');
        });
      } else {
        urlInput.select();
        document.execCommand('copy');
        showToast('Đã sao chép link!', 'success');
      }
    } else {
      showToast('Đang kết nối link, vui lòng chờ vài giây...', 'info');
    }
  });
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('hidden');
}

function closeAllModals() {
  ['modalShareOnline', 'modalTeam', 'modalWorker', 'modalAdvance'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

// Kiểm tra và cập nhật trạng thái link Online
async function checkOnlineStatus(isManual = false) {
  try {
    const res = await fetch('/api/online-status');
    const json = await res.json();
    if (json.success) {
      const urlInput = document.getElementById('inputPublicUrl');
      const imgQr = document.getElementById('imgQrCode');
      const loadingQr = document.getElementById('qrCodeLoading');
      const statusText = document.getElementById('shareModalStatus');

      const targetUrl = json.publicUrl || json.localUrl;

      if (urlInput && targetUrl) {
        urlInput.value = targetUrl;
      }

      if (json.qrCode && imgQr) {
        imgQr.src = json.qrCode;
        imgQr.classList.remove('hidden');
        if (loadingQr) loadingQr.classList.add('hidden');
      }

      if (statusText) {
        if (json.isVercel) {
          statusText.textContent = '🟢 Đang chạy trên Vercel Cloud 24/7 (chamcongkhoan-hiree.vercel.app)';
          statusText.className = 'text-emerald-700 font-bold';
        } else if (json.publicUrl) {
          statusText.textContent = '🟢 Kênh Online Toàn Cầu Đang Sẵn Sàng (4G/5G)';
          statusText.className = 'text-emerald-700 font-bold';
        } else {
          statusText.textContent = '🟡 Đang kết nối Online...';
        }
      }
    }
  } catch (e) {
    console.error('Lỗi kiểm tra online status:', e);
  }
}

function openEditTeamModal(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  document.getElementById('modalTeamTitle').textContent = 'Chỉnh Sửa Đội Khoán';
  document.getElementById('teamModalId').value = team.id;
  document.getElementById('teamModalName').value = team.name || '';
  document.getElementById('teamModalLeader').value = team.leader || '';
  document.getElementById('teamModalPhone').value = team.phone || '';
  document.getElementById('teamModalRate').value = team.defaultRate || '';
  document.getElementById('teamModalNote').value = team.note || '';

  openModal('modalTeam');
}

async function deleteTeam(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;

  if (!confirm(`Bạn có chắc muốn xóa đội "${team.name}"? Dữ liệu chấm công trước đó của đội này vẫn được bảo toàn trong lịch sử.`)) return;

  try {
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast(`Đã xóa đội "${team.name}"`, 'success');
      await refreshData();
      populateTeamDropdowns();
      renderTeamsConfig();
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi xóa đội', 'error');
  }
}

function openAddWorkerModal(teamId) {
  document.getElementById('workerModalTeamId').value = teamId;
  document.getElementById('formWorker').reset();
  openModal('modalWorker');
}

async function removeWorkerFromTeam(teamId, workerId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team || !team.workers) return;

  const worker = team.workers.find(w => w.id === workerId);
  if (!confirm(`Xóa thợ "${worker ? worker.name : ''}" khỏi danh sách thành viên đội?`)) return;

  team.workers = team.workers.filter(w => w.id !== workerId);

  try {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workers: team.workers })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Đã xóa thợ khỏi đội', 'success');
      await refreshData();
      if (state.currentTab === 'tab-detail') renderDetailAttendanceView();
      if (state.currentTab === 'tab-teams') renderTeamsConfig();
    }
  } catch (err) {
    console.error(err);
    showToast('Lỗi khi xóa thợ', 'error');
  }
}


// ========================================================
// HÀM TIỆN ÍCH DÙNG CHUNG
// ========================================================

async function refreshData() {
  try {
    const res = await fetch('/api/data');
    const json = await res.json();
    if (json.success && json.data) {
      state.settings = json.data.settings || {};
      state.teams = json.data.teams || [];
      state.attendance = json.data.attendance || [];
      state.advances = json.data.advances || [];
      renderQuickAttendance();
    }
  } catch (err) {
    console.error('Lỗi khi làm mới dữ liệu:', err);
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  const iconEl = document.getElementById('toastIcon');

  if (!toast || !msgEl) return;

  msgEl.textContent = message;

  if (type === 'error') {
    iconEl.setAttribute('data-lucide', 'alert-circle');
    iconEl.className = 'w-5 h-5 text-rose-400';
  } else if (type === 'info') {
    iconEl.setAttribute('data-lucide', 'info');
    iconEl.className = 'w-5 h-5 text-blue-400';
  } else {
    iconEl.setAttribute('data-lucide', 'check-circle');
    iconEl.className = 'w-5 h-5 text-emerald-400';
  }

  if (window.lucide) lucide.createIcons();

  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
