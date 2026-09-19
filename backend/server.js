require('dotenv').config();
const express = require('express');
const cors = require('cors');

const projectsRouter = require('./routes/projects');
const filesRouter = require('./routes/files');
const importDriveRouter = require('./routes/importDrive');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/projects', projectsRouter);
app.use('/api/projects', importDriveRouter); // /api/projects/:id/import
app.use('/api/files', filesRouter);

app.use((req, res) => res.status(404).json({ error: 'Route tidak ditemukan' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend jalan di http://localhost:${PORT}`));
