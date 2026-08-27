import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Multi-Tenant SaaS Backend listening on http://localhost:${PORT} and http://192.168.0.249:${PORT}`);
});
