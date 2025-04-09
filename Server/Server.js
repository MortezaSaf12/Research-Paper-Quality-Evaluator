require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
console.log("API Key:", process.env.GEMINI_API_KEY);

const pdfRoutes = require('./Routes/pdfRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'Client')));
app.use('/api/pdf', pdfRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
});
