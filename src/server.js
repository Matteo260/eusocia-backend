require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const groupsRoutes = require('./routes/groups');
const usersRoutes = require('./routes/users');
const notificationsRoutes = require('./routes/notifications');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Eu Socia backend running on port ${PORT}`);
});
