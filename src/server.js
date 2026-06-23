require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');

const app = express();

app.use(cors());
app.use(express.json());

// Health check — gamitin natin ito para tingnan kung gumagana ang server (hal. https://your-app.up.railway.app/health)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route na hindi nahanap.' });
});

// Generic error handler (huling safety net)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'May problema sa server.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Eu Socia backend tumatakbo sa port ${PORT}`);
});
