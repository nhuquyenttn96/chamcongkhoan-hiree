const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DATA_FILE = path.join(DATA_DIR, 'chamcong_data.json');

// Biến lưu trữ trạng thái kết nối Online
let publicOnlineUrl = null;
let publicQrCode = null;
let cloudflaredProcess = null;

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Hàm đọc dữ liệu an toàn
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { settings: {}, teams: [], attendance: [], advances: [] };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Lỗi khi đọc file dữ liệu:', error);
    return { settings: {}, teams: [], attendance: [], advances: [] };
  }
}

// Hàm ghi dữ liệu nguyên tử & tự động sao lưu
function saveData(data) {
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, jsonString, 'utf8');
    fs.renameSync(tempFile, DATA_FILE);

    // Tự động sao lưu định kỳ
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const backupFile = path.join(BACKUP_DIR, `backup_${dateStr}.json`);
    fs.writeFileSync(backupFile, jsonString, 'utf8');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu:', error);
    return false;
  }
}

// Lấy IP mạng LAN của máy tính
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Khởi động kênh Cloudflare Tunnel cho điện thoại 4G từ xa
function startCloudflareTunnel(port) {
  const exePath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(exePath)) {
    console.log('⚠️ Không tìm thấy cloudflared.exe, bỏ qua mở kênh Online tự động.');
    return;
  }

  console.log('⏳ Đang kết nối mạng vệ tinh Cloudflare để tạo link Online cho điện thoại 4G...');
  
  cloudflaredProcess = spawn(exePath, ['tunnel', '--url', `http://localhost:${port}`]);

  const handleTunnelOutput = async (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !publicOnlineUrl) {
      publicOnlineUrl = match[0];
      try {
        publicQrCode = await QRCode.toDataURL(publicOnlineUrl, { width: 280, margin: 2 });
      } catch (e) {
        console.error('Lỗi tạo mã QR:', e);
      }

      console.log('\n================================================================');
      console.log('🌐 ĐÃ PHÁT ĐƯỜNG LINK ONLINE TOÀN CẦU (CHO ĐIỆN THOẠI 4G/5G):');
      console.log(`👉 BẤM HOẶC GỬI QUA ZALO: ${publicOnlineUrl}`);
      console.log('📱 Bất kỳ ai ở bất kỳ đâu chỉ cần bấm link trên điện thoại là chấm công được!');
      console.log('================================================================\n');
    }
  };

  cloudflaredProcess.stderr.on('data', handleTunnelOutput);
  cloudflaredProcess.stdout.on('data', handleTunnelOutput);

  cloudflaredProcess.on('close', (code) => {
    console.log(`Kênh Cloudflare Tunnel đã đóng (mã: ${code})`);
    publicOnlineUrl = null;
    publicQrCode = null;
  });
}

// Dọn dẹp tiến trình khi tắt
process.on('SIGINT', () => {
  if (cloudflaredProcess) cloudflaredProcess.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  if (cloudflaredProcess) cloudflaredProcess.kill();
  process.exit();
});

// ====================== CÁC API ENDPOINTS ======================

// 0. API Lấy thông tin kết nối Online & Mã QR
app.get('/api/online-status', (req, res) => {
  const localIps = getLocalIpAddresses();
  const localUrl = localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`;
  
  res.json({
    success: true,
    publicUrl: publicOnlineUrl,
    localUrl,
    qrCode: publicQrCode,
    isOnline: !!publicOnlineUrl,
    message: publicOnlineUrl 
      ? 'Kênh Online 4G đang hoạt động' 
      : 'Đang khởi tạo kênh kết nối Online...'
  });
});

// 1. Lấy toàn bộ dữ liệu
app.get('/api/data', (req, res) => {
  const data = readData();
  res.json({ success: true, data });
});

// 2. Cập nhật Settings
app.post('/api/settings', (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  saveData(data);
  res.json({ success: true, settings: data.settings });
});

// 3. Quản lý Đội khoán (Teams)
app.post('/api/teams', (req, res) => {
  const data = readData();
  const newTeam = {
    id: 'team_' + Date.now(),
    name: req.body.name || 'Đội khoán mới',
    leader: req.body.leader || '',
    phone: req.body.phone || '',
    defaultRate: Number(req.body.defaultRate) || 0,
    unit: req.body.unit || 'Công',
    note: req.body.note || '',
    workers: req.body.workers || []
  };
  data.teams.push(newTeam);
  saveData(data);
  res.json({ success: true, team: newTeam });
});

app.put('/api/teams/:id', (req, res) => {
  const data = readData();
  const index = data.teams.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đội khoán' });
  }
  data.teams[index] = {
    ...data.teams[index],
    ...req.body,
    id: req.params.id
  };
  saveData(data);
  res.json({ success: true, team: data.teams[index] });
});

app.delete('/api/teams/:id', (req, res) => {
  const data = readData();
  data.teams = data.teams.filter(t => t.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// 4. Chấm công Tổng hợp (Batch/Single Total Attendance)
app.post('/api/attendance/batch', (req, res) => {
  const { date, items } = req.body;
  if (!date || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
  }

  const data = readData();

  items.forEach(item => {
    const team = data.teams.find(t => t.id === item.teamId);
    const teamName = team ? team.name : 'Đội khoán';
    const rate = Number(item.rate !== undefined ? item.rate : (team ? team.defaultRate : 0));
    const totalWorkDays = Number(item.totalWorkDays) || 0;
    const otHours = Number(item.otHours) || 0;
    const otMultiplier = (data.settings && data.settings.defaultOtMultiplier) || 1.5;
    const otInDays = (otHours / 8) * otMultiplier;
    const totalAmount = Math.round((totalWorkDays + otInDays) * rate);

    const recordId = `att_${date.replace(/-/g, '')}_${item.teamId}`;
    const existingIndex = data.attendance.findIndex(a => a.id === recordId || (a.date === date && a.teamId === item.teamId));

    const record = {
      id: recordId,
      date,
      teamId: item.teamId,
      teamName,
      type: 'TOTAL',
      totalWorkDays,
      otHours,
      taskCategory: item.taskCategory || '',
      rate,
      totalAmount,
      note: item.note || '',
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      data.attendance[existingIndex] = record;
    } else {
      data.attendance.push(record);
    }
  });

  saveData(data);
  res.json({ success: true, message: 'Lưu chấm công thành công' });
});

// 5. Chấm công Chi tiết theo từng Thợ (Detail Attendance)
app.post('/api/attendance/detail', (req, res) => {
  const { date, teamId, workerRecords, taskCategory, note, rate } = req.body;
  if (!date || !teamId || !Array.isArray(workerRecords)) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin chấm chi tiết' });
  }

  const data = readData();
  const team = data.teams.find(t => t.id === teamId);
  const teamName = team ? team.name : 'Đội khoán';
  const effectiveRate = Number(rate !== undefined ? rate : (team ? team.defaultRate : 0));

  let totalWorkDays = 0;
  let totalOtHours = 0;

  const sanitizedWorkers = workerRecords.map(w => {
    const workDay = Number(w.workDay) || 0;
    const otHours = Number(w.otHours) || 0;
    totalWorkDays += workDay;
    totalOtHours += otHours;
    return {
      workerId: w.workerId,
      workerName: w.workerName,
      role: w.role || 'Thợ',
      workDay,
      otHours,
      status: w.status || (workDay > 0 ? 'present' : 'absent'),
      note: w.note || ''
    };
  });

  const otMultiplier = (data.settings && data.settings.defaultOtMultiplier) || 1.5;
  const otInDays = (totalOtHours / 8) * otMultiplier;
  const totalAmount = Math.round((totalWorkDays + otInDays) * effectiveRate);

  const recordId = `att_${date.replace(/-/g, '')}_${teamId}`;
  const existingIndex = data.attendance.findIndex(a => a.id === recordId || (a.date === date && a.teamId === teamId));

  const record = {
    id: recordId,
    date,
    teamId,
    teamName,
    type: 'DETAIL',
    totalWorkDays,
    otHours: totalOtHours,
    taskCategory: taskCategory || '',
    rate: effectiveRate,
    totalAmount,
    note: note || '',
    workerRecords: sanitizedWorkers,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    data.attendance[existingIndex] = record;
  } else {
    data.attendance.push(record);
  }

  saveData(data);
  res.json({ success: true, record });
});

// 6. Xóa bản ghi chấm công
app.delete('/api/attendance/:id', (req, res) => {
  const data = readData();
  data.attendance = data.attendance.filter(a => a.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// 7. Quản lý Tạm ứng (Advances)
app.post('/api/advances', (req, res) => {
  const data = readData();
  const team = data.teams.find(t => t.id === req.body.teamId);
  const newAdv = {
    id: 'adv_' + Date.now(),
    date: req.body.date || new Date().toISOString().slice(0, 10),
    teamId: req.body.teamId,
    teamName: team ? team.name : req.body.teamName || '',
    amount: Number(req.body.amount) || 0,
    recipient: req.body.recipient || '',
    reason: req.body.reason || '',
    note: req.body.note || ''
  };
  data.advances.push(newAdv);
  saveData(data);
  res.json({ success: true, advance: newAdv });
});

app.put('/api/advances/:id', (req, res) => {
  const data = readData();
  const index = data.advances.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu tạm ứng' });
  }
  data.advances[index] = {
    ...data.advances[index],
    ...req.body,
    id: req.params.id
  };
  saveData(data);
  res.json({ success: true, advance: data.advances[index] });
});

app.delete('/api/advances/:id', (req, res) => {
  const data = readData();
  data.advances = data.advances.filter(a => a.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

// 8. Sao lưu và khôi phục
app.get('/api/backup/export', (req, res) => {
  const data = readData();
  res.setHeader('Content-Disposition', 'attachment; filename=chamcong_backup.json');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/backup/restore', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, message: 'Dữ liệu không đúng định dạng' });
  }
  saveData(req.body);
  res.json({ success: true, message: 'Khôi phục dữ liệu thành công' });
});

// Khởi động server
app.listen(PORT, '0.0.0.0', async () => {
  const localIps = getLocalIpAddresses();
  console.log(`====================================================`);
  console.log(`🚀 HỆ THỐNG: Chấm công đội_HIREE ĐÃ SẴN SÀNG!`);
  console.log(`👉 Cổng máy chủ: ${PORT}`);
  console.log(`====================================================`);

  // Nếu đang chạy trên máy chủ Cloud (Render.com)
  if (process.env.RENDER_EXTERNAL_URL || process.env.RENDER) {
    publicOnlineUrl = process.env.RENDER_EXTERNAL_URL || 'https://chamcongkhoan-hiree.onrender.com';
    try {
      publicQrCode = await QRCode.toDataURL(publicOnlineUrl, { width: 280, margin: 2 });
    } catch (e) {
      console.error('Lỗi tạo mã QR:', e);
    }
    console.log(`🌐 MÁY CHỦ CLOUD 24/7 ĐANG CHẠY TẠI: ${publicOnlineUrl}`);
  } else {
    // Nếu chạy cục bộ trên máy tính, kích hoạt Cloudflare Tunnel
    localIps.forEach(ip => {
      console.log(`👉 Mở trên cùng Wi-Fi: http://${ip}:${PORT}`);
    });
    startCloudflareTunnel(PORT);
  }
});
