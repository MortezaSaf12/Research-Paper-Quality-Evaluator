const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const pdfController = require('../Controllers/pdfController');

router.post('/upload', upload.single('pdf'), pdfController.uploadPDF);

module.exports = router;
