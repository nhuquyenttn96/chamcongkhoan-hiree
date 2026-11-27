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

// Đảm bảo thư mục tồn tại nếu ở môi trường có filesystem
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
} catch (e) {}

const TMP_DATA_FILE = path.join('/tmp', 'chamcong_data.json');

// Đọc dữ liệu: Ưu tiên Cloud KV, fallback sang /tmp (Vercel) hoặc local JSON
async function readData() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/chamcong_data`, {
        headers: { Authorization: `Bearer ${kvToken}` }
      });
      const json = await res.json();
      if (json && json.result) {
        return typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
      }
    } catch (e) {
      console.error('Lỗi đọc từ Cloud KV:', e);
    }
  }

  // Nếu trên Vercel, kiểm tra file trong /tmp trước
  if (process.env.VERCEL && fs.existsSync(TMP_DATA_FILE)) {
    try {
      const raw = fs.readFileSync(TMP_DATA_FILE, 'utf8');
      return JSON.parse(raw);
    } catch (e) {}
  }

  // Fallback đọc file local
  try {
    const filePath = fs.existsSync(DATA_FILE) ? DATA_FILE : path.join(__dirname, 'data', 'chamcong_data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Lỗi khi đọc file dữ liệu:', error);
  }
  return { settings: { projectName: "Chấm công đội_HIREE" }, teams: [], attendance: [], advances: [] };
}

// Lưu dữ liệu: Ghi đồng thời lên Cloud KV, /tmp và local JSON
async function saveData(data) {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      await fetch(`${kvUrl}/set/chamcong_data`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(data))
      });
    } catch (e) {
      console.error('Lỗi ghi vào Cloud KV:', e);
    }
  }

  const jsonString = JSON.stringify(data, null, 2);

  // Nếu trên Vercel, ghi vào /tmp
  if (process.env.VERCEL) {
    try {
      fs.writeFileSync(TMP_DATA_FILE, jsonString, 'utf8');
    } catch (e) {}
  }

  // Ghi file local an toàn nếu có thể ghi đĩa
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonString, 'utf8');
    fs.renameSync(tempFile, DATA_FILE);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const backupFile = path.join(BACKUP_DIR, `backup_${dateStr}.json`);
    fs.writeFileSync(backupFile, jsonString, 'utf8');
    return true;
  } catch (error) {
    return true;
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

// Khởi động kênh Cloudflare Tunnel cho điện thoại 4G khi chạy local
function startCloudflareTunnel(port) {
  const exePath = path.join(__dirname, 'cloudflared.exe');
  if (!fs.existsSync(exePath)) return;

  cloudflaredProcess = spawn(exePath, ['tunnel', '--url', `http://localhost:${port}`]);

  const handleTunnelOutput = async (data) => {
    const output = data.toString();
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !publicOnlineUrl) {
      publicOnlineUrl = match[0];
      try {
        publicQrCode = await QRCode.toDataURL(publicOnlineUrl, { width: 280, margin: 2 });
      } catch (e) {}

      console.log('\n================================================================');
      console.log('🌐 ĐÃ PHÁT ĐƯỜNG LINK ONLINE TOÀN CẦU (CHO ĐIỆN THOẠI 4G/5G):');
      console.log(`👉 BẤM HOẶC GỬI QUA ZALO: ${publicOnlineUrl}`);
      console.log('📱 Bất kỳ ai ở bất kỳ đâu chỉ cần bấm link trên điện thoại là chấm công được!');
      console.log('================================================================\n');
    }
  };

  cloudflaredProcess.stderr.on('data', handleTunnelOutput);
  cloudflaredProcess.stdout.on('data', handleTunnelOutput);

  cloudflaredProcess.on('close', () => {
    publicOnlineUrl = null;
    publicQrCode = null;
  });
}

// ====================== CÁC API ENDPOINTS ======================

// 0. API Lấy thông tin kết nối Online & Mã QR
app.get('/api/online-status', async (req, res) => {
  const localIps = getLocalIpAddresses();
  const localUrl = localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`;
  
  // Nếu đang chạy trên Vercel
  const isVercel = !!process.env.VERCEL;
  const vercelUrl = isVercel ? 'https://chamcongkhoan-hiree.vercel.app' : null;

  if (vercelUrl && !publicQrCode) {
    try {
      publicQrCode = await QRCode.toDataURL(vercelUrl, { width: 280, margin: 2 });
    } catch (e) {}
  }

  const finalPublicUrl = vercelUrl || publicOnlineUrl;

  res.json({
    success: true,
    publicUrl: finalPublicUrl,
    localUrl,
    qrCode: publicQrCode,
    isOnline: !!finalPublicUrl,
    isVercel,
    message: finalPublicUrl 
      ? 'Kênh Online đang hoạt động 24/7' 
      : 'Đang kết nối mạng Online...'
  });
});

// 1. Lấy toàn bộ dữ liệu
app.get('/api/data', async (req, res) => {
  const data = await readData();
  res.json({ success: true, data });
});

// 2. Cập nhật Settings
app.post('/api/settings', async (req, res) => {
  const data = await readData();
  data.settings = { ...data.settings, ...req.body };
  await saveData(data);
  res.json({ success: true, settings: data.settings });
});

// 3. Quản lý Đội khoán (Teams)
app.post('/api/teams', async (req, res) => {
  const data = await readData();
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
  await saveData(data);
  res.json({ success: true, team: newTeam });
});

app.put('/api/teams/:id', async (req, res) => {
  const data = await readData();
  const index = data.teams.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đội khoán' });
  }
  data.teams[index] = {
    ...data.teams[index],
    ...req.body,
    id: req.params.id
  };
  await saveData(data);
  res.json({ success: true, team: data.teams[index] });
});

app.delete('/api/teams/:id', async (req, res) => {
  const data = await readData();
  data.teams = data.teams.filter(t => t.id !== req.params.id);
  await saveData(data);
  res.json({ success: true });
});

// 4. Chấm công Tổng hợp (Batch/Single Total Attendance)
app.post('/api/attendance/batch', async (req, res) => {
  const { date, items } = req.body;
  if (!date || !Array.isArray(items)) {
    return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
  }

  const data = await readData();

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

  await saveData(data);
  res.json({ success: true, message: 'Lưu chấm công thành công' });
});

// 5. Chấm công Chi tiết theo từng Thợ (Detail Attendance)
app.post('/api/attendance/detail', async (req, res) => {
  const { date, teamId, workerRecords, taskCategory, note, rate } = req.body;
  if (!date || !teamId || !Array.isArray(workerRecords)) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin chấm chi tiết' });
  }

  const data = await readData();
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

  await saveData(data);
  res.json({ success: true, record });
});

// 6. Xóa bản ghi chấm công
app.delete('/api/attendance/:id', async (req, res) => {
  const data = await readData();
  data.attendance = data.attendance.filter(a => a.id !== req.params.id);
  await saveData(data);
  res.json({ success: true });
});

// 7. Quản lý Tạm ứng (Advances)
app.post('/api/advances', async (req, res) => {
  const data = await readData();
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
  await saveData(data);
  res.json({ success: true, advance: newAdv });
});

app.put('/api/advances/:id', async (req, res) => {
  const data = await readData();
  const index = data.advances.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu tạm ứng' });
  }
  data.advances[index] = {
    ...data.advances[index],
    ...req.body,
    id: req.params.id
  };
  await saveData(data);
  res.json({ success: true, advance: data.advances[index] });
});

app.delete('/api/advances/:id', async (req, res) => {
  const data = await readData();
  data.advances = data.advances.filter(a => a.id !== req.params.id);
  await saveData(data);
  res.json({ success: true });
});

// 8. Sao lưu và khôi phục
app.get('/api/backup/export', async (req, res) => {
  const data = await readData();
  res.setHeader('Content-Disposition', 'attachment; filename=chamcong_backup.json');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.post('/api/backup/restore', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ success: false, message: 'Dữ liệu không đúng định dạng' });
  }
  await saveData(req.body);
  res.json({ success: true, message: 'Khôi phục dữ liệu thành công' });
});

// Khởi động server cục bộ nếu không phải Vercel Serverless
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', async () => {
    const localIps = getLocalIpAddresses();
    console.log(`====================================================`);
    console.log(`🚀 HỆ THỐNG: Chấm công đội_HIREE ĐÃ SẴN SÀNG!`);
    console.log(`👉 Cổng máy chủ: ${PORT}`);
    console.log(`====================================================`);

    localIps.forEach(ip => {
      console.log(`👉 Mở trên cùng Wi-Fi: http://${ip}:${PORT}`);
    });
    startCloudflareTunnel(PORT);
  });
}

// Xuất app cho Vercel Serverless handler
module.exports = app;
